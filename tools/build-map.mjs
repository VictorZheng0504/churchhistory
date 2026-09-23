// 生成 assets/map-data.js：预先把海岸线投影成 SVG 路径，网站运行时不依赖任何地图库或 CDN。
// 用法：npm install && npm run build:map
// 只画海岸线（land），不画国界——现代国界放在 16 世纪地图上会误导学员。
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoPath, geoClipRectangle } from 'd3-geo';

const require = createRequire(import.meta.url);
const topo50 = require('world-atlas/land-50m.json');
const topo110 = require('world-atlas/land-110m.json');
const land50 = feature(topo50, topo50.objects.land);
// 大范围视图用 1:1.1 亿海岸线就够清楚，文件也小得多
const land110 = feature(topo110, topo110.objects.land);

// 等距圆柱投影，按中心纬度压缩经度。浏览器端 assets/app.js 用同样的公式投影城市坐标。
function makeView({ lon0, lon1, lat0, lat1, width, land = land50 }) {
  const cos = Math.cos(((lat0 + lat1) / 2) * Math.PI / 180);
  const k = width / ((lon1 - lon0) * cos);
  const height = Math.round((lat1 - lat0) * k);
  const project = (lon, lat) => [(lon - lon0) * cos * k, (lat1 - lat) * k];
  const clip = geoClipRectangle(-2, -2, width + 2, height + 2);
  const transform = {
    stream: s => {
      const c = clip(s);
      return {
        point: (x, y) => { const [px, py] = project(x, y); c.point(px, py); },
        lineStart: () => c.lineStart(), lineEnd: () => c.lineEnd(),
        polygonStart: () => c.polygonStart(), polygonEnd: () => c.polygonEnd(),
        sphere: () => {},
      };
    },
  };
  const d = geoPath(transform).digits(1)(land) || '';
  return { lon0, lon1, lat0, lat1, width, height, cos, k, path: d };
}

const data = {
  // 宗教改革时代（第 6–9 课）
  europe: makeView({ lon0: -11, lon1: 30, lat0: 40, lat1: 58.5, width: 1000 }),
  // 早期教会与中世纪（第 1–5 课）：要容下耶路撒冷、亚历山大、迦太基，以及第 4 课的麦加、麦地那
  mediterranean: makeView({ lon0: -11, lon1: 50, lat0: 20, lat1: 56, width: 1000 }),
  newEngland: makeView({ lon0: -74.2, lon1: -69.6, lat0: 40.8, lat1: 43.2, width: 300 }),
  // 北美（第 10、13 课）：殖民地到美国本土
  usa: makeView({ lon0: -125, lon1: -66, lat0: 24, lat1: 50, width: 1000, land: land110 }),
  // 大西洋两岸（大觉醒、浸信会起源）：英国 + 北美东岸
  atlantic: makeView({ lon0: -100, lon1: 35, lat0: 22, lat1: 62, width: 1000, land: land110 }),
  // 世界（宣教运动）：印度、缅甸、中国
  world: makeView({ lon0: -130, lon1: 150, lat0: -40, lat1: 66, width: 1000, land: land110 }),
};

const out = '// 自动生成，勿手改。来源：world-atlas land-50m / land-110m（Natural Earth，公有领域）。重新生成：npm run build:map\n' +
  'window.MAP_DATA = ' + JSON.stringify(data) + ';\n';
fs.writeFileSync(new URL('../assets/map-data.js', import.meta.url), out);
console.log('map-data.js', (out.length / 1024).toFixed(1) + ' KB', Object.entries(data).map(([k, v]) => k + ' ' + v.height).join(', '));
