#!/usr/bin/env python3
"""
AXIONA EVALÚA · Datos del sismo del 10-ago-2026 (USGS us6000tjl2) para usar sin señal.

Descarga de la USGS (API FDSN y productos ShakeMap, ground-failure, DYFI y
pronóstico de réplicas) y deja en public/sismo/ archivos pequeños:

  evento.json          resumen del evento y pronóstico de réplicas
  <ciudad>.json        malla recortada a la ciudad: MMI, PGA, PGV, PSA 0,3/0,6/1,0/3,0 s,
                       Vs30, probabilidad de licuación (Zhu 2017) y de deslizamiento
                       (Nowicki Jessee 2018)
  cont_mmi.json        contornos de intensidad (todo el evento)
  dyfi10.geojson       «¿Lo sintió?» agregado a 10 km, recortado a la región

Uso:  python3 scripts/datos_sismo.py [carpeta_cache]
Requiere: numpy, tifffile, imagecodecs (pip install tifffile imagecodecs).
"""
import json, os, sys, urllib.request, xml.etree.ElementTree as ET
import numpy as np

EVENTO = 'us6000tjl2'
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'public', 'sismo')
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, '.cache', 'usgs')

# Recuadros de las ciudades (lon0, lat0, lon1, lat1) con margen de ~5 km
CIUDADES = {
    'quibdo': (-76.76, 5.58, -76.54, 5.80),
    'pereira': (-75.84, 4.70, -75.54, 4.94),
}
REGION = (-78.0, 3.0, -74.5, 7.3)


def bajar(url, nombre):
    os.makedirs(CACHE, exist_ok=True)
    ruta = os.path.join(CACHE, nombre)
    if not os.path.exists(ruta):
        print('descargando', url)
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'axiona-evalua-datos/1.0'}), timeout=120) as r, open(ruta, 'wb') as f:
            f.write(r.read())
    return ruta


def producto(ev, tipo, archivo):
    c = ev['properties']['products'][tipo][0]['contents']
    return c[archivo]['url']


def leer_grid(ruta):
    """grid.xml de ShakeMap → (campos, matriz nlat×nlon×k, lon0, lat_max, dlon, dlat)."""
    ns = {'s': 'http://earthquake.usgs.gov/eqcenter/shakemap'}
    arbol = ET.parse(ruta).getroot()
    spec = arbol.find('s:grid_specification', ns).attrib
    campos = [f.attrib['name'] for f in sorted(arbol.findall('s:grid_field', ns), key=lambda f: int(f.attrib['index']))]
    datos = np.array(arbol.find('s:grid_data', ns).text.split(), dtype=np.float64).reshape(-1, len(campos))
    nlon, nlat = int(spec['nlon']), int(spec['nlat'])
    M = datos.reshape(nlat, nlon, len(campos))  # fila 0 = latitud máxima
    lon0, lat1 = float(spec['lon_min']), float(spec['lat_max'])
    dlon = (float(spec['lon_max']) - lon0) / (nlon - 1)
    dlat = (lat1 - float(spec['lat_min'])) / (nlat - 1)
    return campos, M, lon0, lat1, dlon, dlat


def recorte_grid(campos, M, lon0, lat1, dlon, dlat, caja):
    x0 = max(0, int(np.floor((caja[0] - lon0) / dlon)))
    x1 = min(M.shape[1] - 1, int(np.ceil((caja[2] - lon0) / dlon)))
    y0 = max(0, int(np.floor((lat1 - caja[3]) / dlat)))
    y1 = min(M.shape[0] - 1, int(np.ceil((lat1 - caja[1]) / dlat)))
    sub = M[y0:y1 + 1, x0:x1 + 1, :]
    salida = {
        'lon0': round(lon0 + x0 * dlon, 6), 'lat0': round(lat1 - y0 * dlat, 6),  # esquina noroeste
        'dlon': round(dlon, 7), 'dlat': round(dlat, 7), 'nlon': sub.shape[1], 'nlat': sub.shape[0],
        'campos': {},
    }
    dec = {'MMI': 2, 'PGA': 3, 'PGV': 2, 'PSA03': 3, 'PSA06': 3, 'PSA10': 3, 'PSA30': 3, 'SVEL': 0}
    for i, c in enumerate(campos):
        if c in ('LON', 'LAT'):
            continue
        salida['campos'][c] = [round(float(v), dec.get(c, 3)) for v in sub[:, :, i].ravel()]
    return salida


def leer_tif(ruta):
    import tifffile
    t = tifffile.TiffFile(ruta)
    p = t.pages[0]
    g = p.geotiff_tags
    a = p.asarray().astype(np.float64)
    sx, sy = g['ModelPixelScale'][:2]
    lon0, lat1 = g['ModelTiepoint'][3], g['ModelTiepoint'][4]
    return a, lon0, lat1, sx, sy


def recorte_tif(a, lon0, lat1, sx, sy, caja, paso=2):
    """Recorta y submuestrea (paso píxeles) tomando el MÁXIMO de cada bloque: lado seguro."""
    x0 = max(0, int((caja[0] - lon0) / sx)); x1 = min(a.shape[1], int(np.ceil((caja[2] - lon0) / sx)))
    y0 = max(0, int((lat1 - caja[3]) / sy)); y1 = min(a.shape[0], int(np.ceil((lat1 - caja[1]) / sy)))
    sub = a[y0:y1, x0:x1]
    h, w = sub.shape[0] // paso, sub.shape[1] // paso
    sub = sub[:h * paso, :w * paso].reshape(h, paso, w, paso)
    with np.errstate(all='ignore'):
        bloque = np.nanmax(np.nanmax(sub, axis=3), axis=1)
    val = [None if np.isnan(v) else round(float(v), 4) for v in bloque.ravel()]
    # centro del primer bloque
    return {'lon0': round(lon0 + (x0 + paso / 2) * sx, 6), 'lat0': round(lat1 - (y0 + paso / 2) * sy, 6),
            'dlon': round(sx * paso, 7), 'dlat': round(sy * paso, 7), 'nlon': w, 'nlat': h, 'valores': val}


def recorte_geojson(gj, caja):
    def dentro(c):
        return caja[0] <= c[0] <= caja[2] and caja[1] <= c[1] <= caja[3]

    def algun_punto(geom):
        t, c = geom['type'], geom['coordinates']
        if t == 'Point':
            return dentro(c)
        if t == 'Polygon':
            return any(dentro(p) for p in c[0])
        if t == 'MultiPolygon':
            return any(dentro(p) for pol in c for p in pol[0])
        return True
    gj['features'] = [f for f in gj['features'] if f.get('geometry') and algun_punto(f['geometry'])]
    return gj


def main():
    os.makedirs(SALIDA, exist_ok=True)
    ev = json.load(open(bajar(f'https://earthquake.usgs.gov/fdsnws/event/1/query?eventid={EVENTO}&format=geojson', 'evento.json')))
    p = ev['properties']
    lon, lat, prof = ev['geometry']['coordinates']

    campos, M, lon0, lat1, dlon, dlat = leer_grid(bajar(producto(ev, 'shakemap', 'download/grid.xml'), 'grid.xml'))
    liq = leer_tif(bajar(producto(ev, 'ground-failure', 'zhu_2017_general_model.tif'), 'zhu_2017.tif'))
    des = leer_tif(bajar(producto(ev, 'ground-failure', 'jessee_2018_model.tif'), 'jessee_2018.tif'))

    for nombre, caja in CIUDADES.items():
        g = recorte_grid(campos, M, lon0, lat1, dlon, dlat, caja)
        g['licuacion'] = recorte_tif(*liq, caja)
        g['deslizamiento'] = recorte_tif(*des, caja)
        g['fuente'] = {'shakemap': p['products']['shakemap'][0]['properties'].get('version'), 'evento': EVENTO,
                       'unidades': {'MMI': 'intensidad', 'PGA': '%g', 'PGV': 'cm/s', 'PSA03': '%g', 'PSA06': '%g', 'PSA10': '%g', 'PSA30': '%g', 'SVEL': 'm/s'},
                       'licuacion': 'Zhu et al. (2017), probabilidad de área con licuación', 'deslizamiento': 'Nowicki Jessee et al. (2018), probabilidad de área con deslizamientos'}
        json.dump(g, open(os.path.join(SALIDA, f'{nombre}.json'), 'w'), separators=(',', ':'))
        print(nombre, g['nlon'], 'x', g['nlat'], 'nodos; MMI máx', max(g['campos']['MMI']))

    fc = json.load(open(bajar(producto(ev, 'oaf', 'forecast.json'), 'forecast.json')))
    pron = {'creado': fc['creationTime'], 'modelo': fc['model']['name'],
            'ventanas': [{'etiqueta': w['label'], 'desde': w['timeStart'], 'hasta': w['timeEnd'],
                          'probabilidades': [{'mag': b['magnitude'], 'p': b['probability'], 'n95': [b['p95minimum'], b['p95maximum']]} for b in w['bins']]}
                         for w in fc['forecast']]}
    resumen = {
        'id': EVENTO, 'titulo': p['title'], 'mag': p['mag'], 'tipoMag': p.get('magType'), 'hora': p['time'],
        'lat': lat, 'lon': lon, 'profundidadKm': prof, 'alertaPager': p.get('alert'), 'mmiMax': p.get('mmi'), 'dyfiRespuestas': p.get('felt'),
        'url': p['url'], 'pronostico': pron,
        'notas': [
            'Fuente oficial en Colombia: Servicio Geológico Colombiano (SGC). La magnitud preliminar del SGC fue 6,7; la USGS la calculó en Mww 7,4. No se mezclan cifras.',
            'La profundidad varía entre 82 y 116 km según la agencia y la versión del boletín.',
        ],
    }
    json.dump(resumen, open(os.path.join(SALIDA, 'evento.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

    cont = json.load(open(bajar(producto(ev, 'shakemap', 'download/cont_mmi.json'), 'cont_mmi.json')))
    json.dump(cont, open(os.path.join(SALIDA, 'cont_mmi.json'), 'w'), separators=(',', ':'))
    dy = json.load(open(bajar(producto(ev, 'dyfi', 'dyfi_geo_10km.geojson'), 'dyfi10.geojson')))
    json.dump(recorte_geojson(dy, REGION), open(os.path.join(SALIDA, 'dyfi10.geojson'), 'w'), separators=(',', ':'))
    print('listo:', sorted(os.listdir(SALIDA)))


if __name__ == '__main__':
    main()
