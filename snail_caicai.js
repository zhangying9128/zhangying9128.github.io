/*!
 * Snail_caicai.js — 网页边缘的小蜗牛「菜菜」
 * 用法：在页面 </body> 前加一行  <script src="Snail_caicai.js"></script>
 * 不依赖任何库，直接双击打开（file://）也能用。
 *
 * 自主行为：沿屏幕边缘爬行（留下会慢慢消失的黏液痕迹）、停下休息、
 *           伸长脖子用触角四处探测、掉头、缩进壳里封上膜睡觉。
 * 鼠标靠近：停下来，用眼柄（大触角）朝鼠标方向探测；碰到眼柄尖，眼柄会缩回去。
 * 点击互动：发出无意义的叫声 / 受惊缩进壳里 / 吃叶子 / 拉便便（颜色跟吃的东西有关），
 *           快速连点会生气地缩壳并吐泡泡；睡觉时点它会醒过来。
 */
(function () {
    'use strict';
    if (window.CuteSnail) return;

    // ===== 可调整的设置 =====
    var CONFIG = {
        size: 50,          // 蜗牛大小（px）。想放大或缩小就改这个数
        mobileSize: 50,    // 窄屏（宽度 < 600px）时的大小
        speed: 2,          // 爬行速度（px/秒）
        drag: true,        // 是否可以用鼠标 / 手指把蜗牛拖到屏幕边缘的任意位置
        remember: true,    // 换页面时记住蜗牛的状态（位置、朝向、在做什么），到下一个页面接着来
        name: '菜菜',       // 蜗牛的名字
        born: '2026-11-14T11:00:00+09:00',   // 出生时间（它从这一刻开始在网站上生活），所有访客看到的生活时长都从这里算起
        hat: '',           // 默认戴的帽子（访客自己没换过时看到的）：'' 不戴 / 'straw' 草帽 / 'top' 礼帽 / 'crown' 皇冠 / 'bow' 蝴蝶结 / 'party' 派对帽 / 'sprout' 小芽
        infoBar: 'nav',    // 信息条放在哪里：'nav' = 放进网站的导航栏里，作为最后一项；
                           //   也可以固定在屏幕的一个角：'bottom-left' / 'bottom-right' / 'top-left' / 'top-right'；false = 不显示
        navList: '.navbar-nav',   // infoBar 为 'nav' 时，往哪个列表里加这一项（选择器）。页面上找不到的话，会退回到左下角
        topBar: 'auto',    // 屏幕顶部固定的导航条：'auto' = 自动识别，蜗牛的“顶边”会改成导航条的下沿；
                           //   也可以写成选择器（比如 '#nav'）；false = 不管导航条，顶边就是屏幕最上面
        route: 'bottom-right',  // 爬行范围：屏幕的 1/4 —— 'bottom-right' 右下 / 'bottom-left' 左下 / 'top-right' 右上 / 'top-left' 左上
                                //           （沿这个角的两条边来回爬）；'all' = 沿四条边绕圈；'bottom' = 只在底边来回爬
        trail: true,       // 是否留下黏液痕迹
        pixel: true,       // true = 像素画风；false = 平滑的手绘风
                           // 像素风下蜗牛的像素图固定是同一张（约 46 格宽），size 只是把它整体放大或缩小。
                           // 为了让每个像素都是整整齐齐的方块，实际大小会自动对齐到屏幕的物理像素，
                           // 所以可能和 size 差几个 px（普通屏幕上最清晰的是 46 / 92 / 138，高清屏上还可以是 69 / 115 等）
        shape: 'classic',  // 壳和身体的造型：'classic' 经典 / 'tall' 高壳 / 'flat' 扁壳 / 'chubby' 胖壳
        look: 'D2'         // 造型方案（见下面的 LOOKS，可以自己加新的）
    };
    // ======================

    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var canHover = !!(window.matchMedia && window.matchMedia('(hover: hover)').matches);

    // ---------- 坐标与几何（蜗牛自身坐标，朝右，脚底在 y = BASE） ----------
    var VBW = 130, VBH = 84, BASE = 74, AX = 60;
    // 壳用对数螺旋生成：越靠近壳口（头那一侧）螺层越大；壳底压平、贴在身体上
    //   cx, cy：螺旋中心   R：壳口处的半径   g：螺层增长速度   end：壳口所在角度（度）
    //   sy：纵向拉伸   neck：脖子斜坡的长度   tilt：整体倾斜（度）
    var SHAPES = {
        classic: { cx: 43, cy: 46, R: 27, g: 0.12, end: 84, sy: 1.0, neck: 11, tilt: 0 },
        tall:    { cx: 42, cy: 43, R: 26, g: 0.1, end: 90, sy: 1.14, neck: 8, tilt: -4 },
        flat:    { cx: 44, cy: 52, R: 29, g: 0.13, end: 80, sy: 0.76, neck: 15, tilt: 3 },
        chubby:  { cx: 41, cy: 44, R: 31, g: 0.08, end: 86, sy: 1.0, neck: 9, tilt: 0 }
    };
    // 身体 + 壳口的造型方案
    //   mouth：壳口样式  'bite' = 壳的前下角有一个拱形开口，脖子顺着开口的边缘伸出来
    //                    'window' = 椭圆形开口，能看到脖子从深色的壳里伸出来
    //                    'rim' = 不开口，壳的前下缘有一道浅色唇边压在身上
    //   qh：脖子从壳里出来的高度   alpha：出壳时背部斜坡的角度（度）
    //   r：头的半径   neck：脖子的粗细（比头的直径 2r 小，头就比脖子宽）   dx, dy：头相对出壳点的位置（前、上）
    //   下巴到地面是一条光滑的曲线，落地的地方是圆角或者贴着地面切入，没有折角：
    //   foot：曲线落到地面的位置（相对出壳点，越大越靠前）
    //   nose / lift：落地前最后一段的走向 —— lift = 0 时贴着地面滑行 nose 这么长再落地（最平缓）；
    //                lift > 0 时从 (nose, lift) 的方向斜着或竖着落下来，落地处是一个小圆角
    //   k1：下巴下面往壳方向收进去的力度（可省略）   wx, wy：可选的“腰”，有它就是先收腰、再向前滑出圆脚尖的 S 形
    var LOOKS = {
        D2: { mouth: 'rim', qh: 17, alpha: 32, r: 13, neck: 15, dx: 22, dy: 11, foot: 0, nose: 13, lift: 0, k1: 3 }     // 长缓坡
    };
    var LOOK = null, D2R = Math.PI / 180;
    var SH = null, SHX = 42;
    function shellGeom(p) {
        var yb = BASE - 6.5, E = p.end * Math.PI / 180, tr = (p.tilt || 0) * Math.PI / 180;
        function pt(th, scale, clampIt) {
            var r = p.R * Math.exp(p.g * (th - E)) * (scale || 1);
            var x = r * Math.cos(th), y = r * Math.sin(th) * p.sy;
            var X = p.cx + x * Math.cos(tr) - y * Math.sin(tr), Y = p.cy + x * Math.sin(tr) + y * Math.cos(tr);
            if (clampIt === false) return [X, Y];
            var sag = Math.pow(clamp(Math.sin(th), 0, 1), 1.6);   // 下半圈往下压，让壳底平平地贴在身体上
            return [X, Math.min(lerp(Y, yb, sag), yb)];
        }
        var N = 140, d = '', xs = [], ys = [], i, q, th;
        for (i = 0; i <= N; i++) {                         // 最外一圈：从壳口内侧绕一圈到壳口外侧
            th = E - 2 * Math.PI + 2 * Math.PI * i / N;
            q = pt(th); xs.push(q[0]); ys.push(q[1]);
            d += (i ? 'L' : 'M') + n2(q[0]) + ' ' + n2(q[1]);
        }
        d += ' Z';                                          // 闭合的这一段就是壳口的边缘
        var su = '';
        for (i = 0; i <= N; i++) {                         // 往里卷的螺纹（缝合线）
            th = E - 2 * Math.PI - 2 * Math.PI * 1.5 * i / N;
            q = pt(th, 1, false);
            su += (i ? 'L' : 'M') + n2(q[0]) + ' ' + n2(q[1]);
        }
        var hl = '';
        for (i = 0; i <= 30; i++) {                        // 高光：沿外圈的上方
            th = (-165 + 85 * i / 30) * Math.PI / 180;
            if (th > E) th -= 2 * Math.PI;
            q = pt(th, 0.8, false);
            hl += (i ? 'L' : 'M') + n2(q[0]) + ' ' + n2(q[1]);
        }
        var a1 = pt(E), a2 = pt(E - 2 * Math.PI);
        return {
            outline: d, suture: su, highlight: hl, pts: xs.map(function (x, j) { return [x, ys[j]]; }), yb: yb,
            front: Math.max.apply(null, xs), back: Math.min.apply(null, xs), top: Math.min.apply(null, ys),
            cx: p.cx, cy: p.cy, a1: a1, a2: a2,
            ax: (a1[0] + a2[0]) / 2, ay: (a1[1] + a2[1]) / 2,
            ar: Math.hypot(a1[0] - a2[0], a1[1] - a2[1]) / 2,
            aang: Math.atan2(a1[1] - a2[1], a1[0] - a2[0]) * 180 / Math.PI,
            neck: p.neck
        };
    }
    var NS = 'http://www.w3.org/2000/svg';
    var TRAIL_MS = 9000;
    var k = 1;                                          // 1 个蜗牛单位 = k px

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function n2(v) { return Math.round(v * 100) / 100; }
    function approach(cur, tgt, upRate, downRate, dt) {
        var r = tgt > cur ? upRate : downRate;
        return cur + (tgt - cur) * (1 - Math.exp(-r * dt));
    }
    function el(tag, attrs, parent) {
        var e = document.createElementNS(NS, tag);
        for (var key in attrs) e.setAttribute(key, attrs[key]);
        if (parent) parent.appendChild(e);
        return e;
    }
    function spiral(cx, cy, r0, r1, turns, start) {
        var d = '', N = 90;
        for (var i = 0; i <= N; i++) {
            var f = i / N, th = start - f * turns * 2 * Math.PI, r = r0 * Math.pow(r1 / r0, f);
            d += (i ? 'L' : 'M') + n2(cx + r * Math.cos(th)) + ' ' + n2(cy + r * Math.sin(th));
        }
        return d;
    }

    // ---------- 样式 ----------
    var CSS = [
        '.snl-root{position:fixed;left:0;top:0;z-index:9990;pointer-events:none;will-change:transform}',
        '.snl-root svg{display:block;overflow:visible;pointer-events:none;-webkit-tap-highlight-color:transparent}',
        '.snl-hit{pointer-events:visiblePainted;cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none}',
        '.snl-dragging .snl-hit{cursor:grabbing}',
        '.snl-trail{position:fixed;left:0;top:0;z-index:9988;pointer-events:none}',
        '.snl-say{position:fixed;z-index:9993;pointer-events:none;font:700 13px/1.25 "Hiragino Maru Gothic ProN","Yu Gothic UI","PingFang SC","Microsoft YaHei",sans-serif;' +
            'color:#2f2219;background:#fffaf0;border:2px solid #2f2219;border-radius:14px;padding:3px 10px;white-space:nowrap;' +
            'box-shadow:2px 2px 0 rgba(47,34,25,.18);transform:translate(-50%,-50%) scale(0)}',
        '.snl-z{position:fixed;z-index:9993;pointer-events:none;font:700 15px/1 "Comic Sans MS","Hiragino Maru Gothic ProN",sans-serif;color:#7d8fb3;' +
            '-webkit-text-stroke:.6px #2f2219;transform:translate(-50%,-50%)}',
        '.snl-foam{position:fixed;z-index:9992;pointer-events:none;border-radius:50%;' +
            'background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.95) 0 18%,rgba(225,240,255,.55) 36%,rgba(190,220,245,.25) 72%);' +
            'border:1.5px solid #2f2219;transform:translate(-50%,-50%)}',
        '.snl-poop{position:fixed;left:0;top:0;z-index:9991;pointer-events:none;overflow:visible;transition:opacity 2s}',
        '.snl-pix{position:fixed;left:0;top:0;z-index:9990;pointer-events:none;image-rendering:crisp-edges;image-rendering:pixelated}',
        '@media print{.snl-root,.snl-trail,.snl-pix,.snl-say,.snl-z,.snl-foam,.snl-poop{display:none!important}}'
    ].join('\n');
    // 像素画风时，气泡、泡沫、便便、黏液也换成方方正正的样子
    var CSS_PIXEL = [
        '.snl-trail,.snl-poop{image-rendering:crisp-edges;image-rendering:pixelated}',
        '.snl-say{border-radius:0;font-family:"Courier New",ui-monospace,"MS Gothic",monospace;border:2px solid #231a14;box-shadow:3px 3px 0 #231a14;color:#231a14}',
        '.snl-z{font-family:"Courier New",ui-monospace,monospace;-webkit-text-stroke:0;color:#5f76a8}',
        '.snl-foam{border-radius:0;background:#e6f1fb;border:2px solid #231a14}'
    ].join('\n');
    // 信息条和信息面板的样式
    var FONT_UI = '"Hiragino Maru Gothic ProN","PingFang SC","Microsoft YaHei","Yu Gothic UI","Noto Sans CJK SC",sans-serif';
    var CSS_INFO = [
        '.snl-bar,.snl-panel,.snl-panel *{box-sizing:border-box}',
        '.snl-bar{position:fixed;z-index:9994;display:flex;align-items:center;gap:7px;height:28px;margin:0;padding:0 10px;background:#fffaf0;color:#231a14;' +
            'border:2px solid #231a14;border-radius:0;box-shadow:3px 3px 0 #231a14;font:700 13px/1 ' + FONT_UI + ';cursor:pointer;white-space:nowrap;' +
            '-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}',
        '.snl-bar:hover,.snl-bar.snl-open{background:#f6e3b0}',
        '.snl-navlink{cursor:pointer;white-space:nowrap;-webkit-user-select:none;user-select:none}',
        '.snl-navlink .snl-dot{margin-right:6px;vertical-align:-1px}',
        '.snl-dot{display:inline-block;width:10px;height:10px;background:#86a86c;border:2px solid #231a14}',
        '.snl-panel{position:fixed;z-index:9994;display:none;width:252px;max-width:calc(100vw - 24px);background:#fffaf0;color:#231a14;text-align:left;' +
            'border:2px solid #231a14;box-shadow:4px 4px 0 #231a14;font:13px/1.55 ' + FONT_UI + '}',
        '.snl-panel.snl-open{display:block}',
        '.snl-tabs{display:flex;background:#efe6d4;border-bottom:2px solid #231a14}',
        '.snl-tab,.snl-close{-webkit-appearance:none;appearance:none;margin:0;border:0;border-radius:0;background:transparent;color:inherit;font:inherit;cursor:pointer;outline-offset:-3px}',
        '.snl-tab{padding:5px 13px;border-right:2px solid #231a14}',
        '.snl-tab.snl-on{background:#fffaf0;font-weight:700;margin-bottom:-2px;padding-bottom:7px}',
        '.snl-close{margin-left:auto;padding:0 10px;font:700 17px/1 sans-serif;color:#8a7762}',
        '.snl-page{display:none;padding:12px}',
        '.snl-page.snl-on{display:block}',
        '.snl-polaroid{width:204px;margin:0 auto 10px;padding:6px 6px 4px;background:#fff;border:2px solid #231a14;box-shadow:3px 3px 0 #d9ccb4;transform:rotate(-1.5deg)}',
        '.snl-photo{display:block;width:192px;height:144px;image-rendering:crisp-edges;image-rendering:pixelated}',
        '.snl-cap{margin-top:3px;text-align:center;font-size:12px;color:#8a7762}',
        '.snl-name{font-size:17px;font-weight:700;line-height:1.3}',
        '.snl-dim{color:#8a7762}',
        '.snl-age{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}',
        '.snl-small{font-size:11px;line-height:1.4;margin-top:4px}',
        '.snl-hats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
        '.snl-hat{-webkit-appearance:none;appearance:none;margin:0;padding:6px 2px 4px;border:2px solid #cdbfa8;border-radius:0;background:#fff;color:inherit;font:12px/1.3 ' + FONT_UI + ';cursor:pointer;' +
            'display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;min-height:58px}',
        '.snl-hat canvas{image-rendering:crisp-edges;image-rendering:pixelated}',
        '.snl-hat:hover{border-color:#8a7762}',
        '.snl-hat.snl-on{border-color:#231a14;background:#f6e3b0;box-shadow:2px 2px 0 #231a14;font-weight:700}',
        '.snl-none{font-size:18px;line-height:27px;color:#b3a48f}',
        '@media print{.snl-bar,.snl-panel{display:none!important}}'
    ].join('\n');
    var PX = CONFIG.pixel ? 2 : 0;                         // 每个“像素格”在屏幕上的大小（px），在 layout() 里按 size 计算；0 = 不用像素风
    var PIX_UNIT = 2.174;                                  // 一个像素格对应多少蜗牛单位（头的直径 ≈ 12 格）

    // ---------- 构建 SVG ----------
    var root, svg, canvas, ctx, P = {};

    function build() {
        var style = document.createElement('style');
        style.textContent = CSS + (PX ? '\n' + CSS_PIXEL : '') + '\n' + CSS_INFO;
        document.head.appendChild(style);

        if (CONFIG.trail) {
            canvas = document.createElement('canvas');
            canvas.className = 'snl-trail';
            document.body.appendChild(canvas);
            ctx = canvas.getContext('2d');
        }

        root = document.createElement('div');
        root.className = 'snl-root';
        root.setAttribute('aria-hidden', 'true');
        svg = el('svg', { viewBox: '0 0 ' + VBW + ' ' + VBH });
        root.appendChild(svg);
        document.body.appendChild(root);

        // ===== 画风：圆滚滚 + 粗描边 + 平涂 + 轻微手绘抖动 =====
        var INK = '#231a14', SKIN = '#efe1cf', SHELL = '#a87a5d', SHELL_LIGHT = '#c49b7c', LEAF = '#7f9f6c';

        var defs = el('defs', {}, svg);
        // 手绘感：让线条有一点点不规则的抖动
        var rough = el('filter', { id: 'snl-rough', x: '-10%', y: '-20%', width: '120%', height: '140%' }, defs);
        el('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.08, numOctaves: 2, seed: 7, result: 'n' }, rough);
        el('feDisplacementMap', { 'in': 'SourceGraphic', in2: 'n', scale: 1.8, xChannelSelector: 'R', yChannelSelector: 'G' }, rough);
        var mask = el('mask', { id: 'snl-leafmask', maskUnits: 'userSpaceOnUse', x: -10, y: -20, width: 40, height: 30 }, defs);
        el('rect', { x: -10, y: -20, width: 40, height: 30, fill: '#fff' }, mask);
        P.bites = el('g', {}, mask);

        var art = P.art = el('g', PX ? {} : { filter: 'url(#snl-rough)' }, svg);
        if (PX) {
            // 像素画风：SVG 只保留用来接收点击（透明），真正看到的是下面这块低分辨率画布
            root.style.opacity = '0';
            pcv = document.createElement('canvas');
            pcv.className = 'snl-pix';
            pcv.setAttribute('aria-hidden', 'true');
            document.body.appendChild(pcv);
            pctx = pcv.getContext('2d');
            wcv = document.createElement('canvas');
            wctx = wcv.getContext('2d', { willReadFrequently: true });
        }
        // 短粗、圆头的触角：描边管 + 圆球头
        // 描边画在身体后面，填色画在身体前面 → 触角和头连成一体，接缝处没有黑线
        function stalkOutline(parent) {
            return {
                o: el('path', { fill: 'none', stroke: INK, 'stroke-width': 7.2, 'stroke-linecap': 'round', 'class': 'snl-hit' }, parent),
                ko: el('circle', { r: 0, fill: INK, 'class': 'snl-hit' }, parent)
            };
        }
        function stalkFill(st, color, parent) {
            st.f = el('path', { fill: 'none', stroke: color, 'stroke-width': 4.4, 'stroke-linecap': 'round', 'class': 'snl-hit' }, parent);
            st.kf = el('circle', { r: 0, fill: color, 'class': 'snl-hit' }, parent);
        }

        // 叶子（吃东西时出现在头前方的地面上）
        P.leaf = el('g', { opacity: 0 }, art);
        P.leaf.style.transition = 'opacity .4s';
        var leafIn = el('g', { mask: 'url(#snl-leafmask)' }, P.leaf);
        el('path', { d: 'M0 0 C3 -9 14 -10 19 -2 C14 1 5 1.5 0 0 Z', fill: LEAF, stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, leafIn);
        el('path', { d: 'M2.5 -1 Q9 -4 15.5 -2.8', fill: 'none', stroke: INK, 'stroke-width': 1.3, 'stroke-linecap': 'round' }, leafIn);

        P.farStalk = stalkOutline(art);
        P.nearStalk = stalkOutline(art);

        // ---- 壳和壳口的几何 ----
        LOOK = LOOKS[CONFIG.look] || LOOKS.D2;
        SH = shellGeom(SHAPES[CONFIG.shape] || SHAPES.classic);
        SHX = SH.cx;
        var RIM = '#e9cfb2', INSIDE = '#5b3f2e';
        // Q：脖子出壳的点 = 壳前缘上离地 qh 高的位置
        var Qp = null, targetY = BASE - LOOK.qh, Np = SH.pts.length;
        for (var qi = Math.floor(Np * 0.6); qi < Np; qi++) {
            var qq = SH.pts[qi];
            if (qq[0] > SH.cx && (!Qp || Math.abs(qq[1] - targetY) < Math.abs(Qp[1] - targetY))) Qp = qq;
        }
        SH.q = [Qp[0], Qp[1]];
        SH.ax = Qp[0] - 8; SH.ay = Qp[1] + 4;                 // 缩壳时头收进去的位置
        var alr = LOOK.alpha * D2R, dAx = Math.cos(alr), dAy = -Math.sin(alr);
        var holeD = null, lipD = null;
        if (LOOK.mouth === 'bite') {
            // 壳口的边缘：从 Q 顺着脖子的斜坡方向往壳里走，再弯下来落到壳底 → 和脖子的背线连成一条光滑的线
            var q2x = Qp[0] - LOOK.lipW;
            lipD = 'M' + n2(Qp[0]) + ' ' + n2(Qp[1]) +
                ' C' + n2(Qp[0] - dAx * LOOK.lipW * 0.55) + ' ' + n2(Qp[1] - dAy * LOOK.lipW * 0.55) +
                ' ' + n2(q2x) + ' ' + n2(lerp(Qp[1], SH.yb, 0.3)) + ' ' + n2(q2x) + ' ' + n2(SH.yb);
            holeD = lipD + ' L' + n2(q2x) + ' ' + (BASE + 8) + ' L' + n2(Qp[0] + 40) + ' ' + (BASE + 8) +
                ' L' + n2(Qp[0] + dAx * 40) + ' ' + n2(Qp[1] + dAy * 40) + ' Z';
        } else if (LOOK.mouth === 'window') {
            var ecx = Qp[0] + LOOK.ex, ecy = Qp[1] + LOOK.ey, rr = LOOK.rot * D2R;
            var e1 = [ecx - LOOK.rx * Math.cos(rr), ecy - LOOK.rx * Math.sin(rr)], e2 = [ecx + LOOK.rx * Math.cos(rr), ecy + LOOK.rx * Math.sin(rr)];
            holeD = 'M' + n2(e1[0]) + ' ' + n2(e1[1]) + ' A' + LOOK.rx + ' ' + LOOK.ry + ' ' + LOOK.rot + ' 1 0 ' + n2(e2[0]) + ' ' + n2(e2[1]) +
                ' A' + LOOK.rx + ' ' + LOOK.ry + ' ' + LOOK.rot + ' 1 0 ' + n2(e1[0]) + ' ' + n2(e1[1]) + ' Z';
        }
        if (holeD) {
            el('path', { d: SH.outline }, el('clipPath', { id: 'snl-shellclip' }, defs));
            el('path', { d: holeD }, el('clipPath', { id: 'snl-holeclip' }, defs));
            var amask = el('mask', { id: 'snl-apmask', maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: 190, height: 130 }, defs);
            el('rect', { x: -20, y: -20, width: 190, height: 130, fill: '#fff' }, amask);
            el('path', { d: holeD, fill: '#000' }, amask);
        }

        // 壳口里面（画在身体下面）：深色的壳内部、睡觉时的封膜、壳口外侧的轮廓线
        P.shellIn = el('g', { 'class': 'snl-hit' }, art);
        if (holeD) {
            var inner = el('g', { 'clip-path': 'url(#snl-holeclip)' }, el('g', { 'clip-path': 'url(#snl-shellclip)' }, P.shellIn));
            el('path', { d: SH.outline, fill: INSIDE }, inner);
            P.epi = el('path', { d: SH.outline, fill: '#fbf6ea', opacity: 0 }, inner);
            el('path', { d: SH.outline, fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' },
                el('g', { 'clip-path': 'url(#snl-holeclip)' }, P.shellIn));
        } else {
            P.epi = el('path', { d: '', opacity: 0 }, P.shellIn);
        }

        // 身体：尾巴 → 斜坡 → 脖子 → 头（画在壳下面，从壳口露出来）
        P.body = el('path', { fill: SKIN, stroke: INK, 'stroke-width': 2.8, 'stroke-linejoin': 'round', 'class': 'snl-hit' }, art);
        P.sole = [];
        for (var i = 0; i < 3; i++) {
            P.sole.push(el('line', { stroke: INK, 'stroke-width': 1.2, 'stroke-linecap': 'round', opacity: 0 }, art));
        }
        stalkFill(P.farStalk, SKIN, art);
        stalkFill(P.nearStalk, SKIN, art);

        // 壳：平涂棕色 + 粗黑螺旋线 + 浅色高光
        P.shell = el('g', { 'class': 'snl-hit' }, art);
        var shellBody = el('g', holeD ? { mask: 'url(#snl-apmask)' } : {}, P.shell);
        el('path', { d: SH.outline, fill: SHELL, stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }, shellBody);
        el('path', { d: SH.highlight, fill: 'none', stroke: SHELL_LIGHT, 'stroke-width': 3.2, 'stroke-linecap': 'round' }, shellBody);
        el('path', { d: SH.suture, fill: 'none', stroke: INK, 'stroke-width': 2.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, shellBody);
        if (LOOK.mouth === 'bite') {
            // 壳口边缘在身体上投下的一道淡淡的阴影，让开口有“罩在身上”的感觉
            el('path', { d: lipD, fill: 'none', stroke: INSIDE, 'stroke-width': 9, opacity: 0.28 },
                el('g', { 'clip-path': 'url(#snl-holeclip)' }, el('g', { 'clip-path': 'url(#snl-shellclip)' }, P.shell)));
            el('path', { d: lipD, fill: 'none', stroke: INK, 'stroke-width': 2.8, 'stroke-linecap': 'round' }, P.shell);
        } else if (LOOK.mouth === 'window') {
            el('path', { d: holeD, fill: 'none', stroke: INK, 'stroke-width': 2.8 }, el('g', { 'clip-path': 'url(#snl-shellclip)' }, P.shell));
            // 开口边缘和壳的轮廓相交的地方补一个小圆点，让接头是圆的
            var inShell = function (x, y) {
                var c = false, pts = SH.pts;
                for (var a = 0, z = pts.length - 1; a < pts.length; z = a++) {
                    if ((pts[a][1] > y) !== (pts[z][1] > y) && x < (pts[z][0] - pts[a][0]) * (y - pts[a][1]) / (pts[z][1] - pts[a][1]) + pts[a][0]) c = !c;
                }
                return c;
            };
            var prevIn = null;
            for (var ei = 0; ei <= 240; ei++) {
                var ea = ei / 240 * 2 * Math.PI;
                var ex0 = LOOK.rx * Math.cos(ea), ey0 = LOOK.ry * Math.sin(ea);
                var px = ecx + ex0 * Math.cos(rr) - ey0 * Math.sin(rr), py = ecy + ex0 * Math.sin(rr) + ey0 * Math.cos(rr);
                var nowIn = inShell(px, py);
                if (prevIn !== null && nowIn !== prevIn) el('circle', { cx: n2(px), cy: n2(py), r: 1.45, fill: INK }, P.shell);
                prevIn = nowIn;
            }
        } else {
            // 'rim'：沿前下方外圈画一道浅色的唇边，压在身体上
            var rimPts = SH.pts.filter(function (q) { return q[0] > SH.cx + 4 && q[1] > SH.yb - 22; });
            if (rimPts.length > 1) {
                var rd = rimPts.map(function (q, j) {
                    var vx = q[0] - SH.cx, vy = q[1] - (SH.yb - 14), L = Math.hypot(vx, vy) || 1;
                    return (j ? 'L' : 'M') + n2(q[0] - vx / L * 3.2) + ' ' + n2(q[1] - vy / L * 3.2);
                }).join('');
                el('path', { d: rd, fill: 'none', stroke: RIM, 'stroke-width': 3.2, 'stroke-linecap': 'round' }, P.shell);
            }
        }

        // 脸：豆豆眼 + 腮红 + 小嘴，表情会随状态变化
        P.face = el('g', {}, art);
        P.blushL = el('ellipse', { rx: 2.7, ry: 1.7, fill: '#f0a19c' }, P.face);
        P.blushR = el('ellipse', { rx: 1.7, ry: 1.6, fill: '#f0a19c' }, P.face);
        P.eyeL = el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, P.face);
        P.eyeR = el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, P.face);
        P.mouth = el('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, P.face);
        P.hat = el('g', { 'shape-rendering': 'crispEdges' }, art);     // 帽子（手绘风时用；像素风时帽子直接画在像素格上）
        P.INK = INK;

        svg.addEventListener('click', onClick);
        svg.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }

    // 身体轮廓：
    //   尾巴 → 背线从壳下面穿过 → 在 Q 点出壳 → 一条光滑的斜坡连到头的后上方（没有折角）
    //   → 绕过圆圆的头 → 下巴往壳的方向收进去（头比脖子宽，像探出头来）→ 腰 → 腹足前端 → 沿地面回到尾巴
    function bodyPath(tx, hx, hy) {
        var L = LOOK, b = BASE, r = L.r, Q = SH.q;
        var al = L.alpha * D2R, dA = [Math.cos(al), -Math.sin(al)];
        // 背线和头相切的方向：由“出壳点到头的切线方向”自动算出，保证背线始终是一条光滑的弧
        var vx = hx - Q[0], vy = Q[1] - hy, dist = Math.hypot(vx, vy) || 1;
        var tau = Math.atan2(vy, vx) + Math.asin(clamp(r / dist, 0, 0.98));
        var phi = clamp(tau + (tau - al) * 0.6, -0.5, 1.54);
        var u = [Math.cos(phi), -Math.sin(phi)], n = [-Math.sin(phi), -Math.cos(phi)];
        var Hb = [hx + r * n[0], hy + r * n[1]];
        var kb = Math.hypot(Hb[0] - Q[0], Hb[1] - Q[1]) * 0.38;
        // 下巴：头绕到脖子前缘的位置才收进去 → 头比脖子宽，下巴悬在外面
        var off = L.neck - r, tt = Math.sqrt(Math.max(r * r - off * off, 0));
        var Nc = [hx - off * n[0] - tt * u[0], hy - off * n[1] - tt * u[1]];
        var angNc = Math.atan2(Nc[1] - hy, Nc[0] - hx) / D2R;
        // 头贴近地面时（比如低头吃叶子）：low 从 0 变到 1，头的轮廓一直绕到头的正下方再直接落地，
        // 脖子下面整个填实 → 头和身体合成一体，中间不再有分隔的黑线
        var low = clamp((hy + r - (b - 11)) / 8, 0, 1);
        low = low * low * (3 - 2 * low);
        var fl = 1 - low;
        var angEnd = lerp((angNc < 0 ? angNc + 360 : angNc) - 16, 80, low);
        var psi = angEnd * D2R, Hc = [hx + r * Math.cos(psi), hy + r * Math.sin(psi)];
        var tc = [-Math.sin(psi), Math.cos(psi)];
        var N1 = [lerp(Nc[0] - u[0] * 4, Hc[0] - 2.5, low), lerp(Nc[1] - u[1] * 4, Math.min(Hc[1] + 1.2, b - 0.4), low)];
        var angHb = Math.atan2(n[1], n[0]) / D2R, sweep = (((angEnd - angHb) % 360) + 360) % 360;
        // 下巴 → 地面：一条光滑的曲线；落地处是圆角或贴着地面切入，没有折角
        var fx = lerp(Q[0] + L.foot, Hc[0] - 5.5, low), nose = lerp(L.nose, 2, low);
        var lift = (L.lift || 0) * fl, P3 = [fx, b], P2 = [fx + nose, b - lift];
        var room = Math.max(0, b - 1.5 - N1[1]), kmax = Math.max(1, room / Math.max(0.25, -u[1]));

        var d = 'M' + n2(tx + 4) + ' ' + b +
            ' Q' + n2(tx - 1.5) + ' ' + (b - 0.5) + ' ' + n2(tx + 0.5) + ' ' + (b - 5) +
            ' C' + n2(tx + 7) + ' ' + (b - 9) + ' ' + n2(Q[0] - dA[0] * 16) + ' ' + n2(Q[1] - dA[1] * 16) + ' ' + n2(Q[0]) + ' ' + n2(Q[1]) +
            ' C' + n2(Q[0] + dA[0] * kb) + ' ' + n2(Q[1] + dA[1] * kb) + ' ' + n2(Hb[0] - u[0] * kb) + ' ' + n2(Hb[1] - u[1] * kb) + ' ' + n2(Hb[0]) + ' ' + n2(Hb[1]) +
            ' A' + r + ' ' + r + ' 0 ' + (sweep > 180 ? 1 : 0) + ' 1 ' + n2(Hc[0]) + ' ' + n2(Hc[1]) +
            ' C' + n2(Hc[0] + tc[0] * 3.2 * fl) + ' ' + n2(Hc[1] + tc[1] * 3.2 * fl) + ' ' + n2(N1[0] + u[0] * 3 * fl) + ' ' + n2(N1[1] + u[1] * 3 * fl) + ' ' + n2(N1[0]) + ' ' + n2(N1[1]);
        var W = L.wx !== undefined ? [Q[0] + L.wx, b - L.wy] : null;
        if (W && N1[1] < W[1] - 2) {
            // S 形：先往壳的方向收到腰，再顺滑地向前伸出一个圆圆的脚尖
            var dw = Math.hypot(N1[0] - W[0], N1[1] - W[1]), kw = Math.min(clamp(dw * 0.45, 1, 12), kmax);
            var T = [fx - 1, b - 6];
            d += ' C' + n2(N1[0] - u[0] * kw) + ' ' + n2(N1[1] - u[1] * kw) + ' ' + n2(W[0]) + ' ' + n2(W[1] - Math.min(dw * 0.4, 6)) + ' ' + n2(W[0]) + ' ' + n2(W[1]) +
                ' C' + n2(W[0]) + ' ' + n2(W[1] + (T[1] - W[1]) * 0.95) + ' ' + n2(T[0] - 4.5) + ' ' + n2(T[1]) + ' ' + n2(T[0]) + ' ' + n2(T[1]) +
                ' C' + n2(T[0] + 4) + ' ' + n2(T[1]) + ' ' + n2(T[0] + 4) + ' ' + b + ' ' + n2(T[0] - 1) + ' ' + b;
        } else {
            var dd = Math.hypot(N1[0] - P2[0], N1[1] - P2[1]);
            var k1 = Math.min(L.k1 !== undefined ? L.k1 : clamp(dd * 0.4, 1, 12), kmax) * fl;
            var c1 = [N1[0] - u[0] * k1, N1[1] - u[1] * k1];
            if (lift > 0.5 && N1[1] < P2[1] - 1) {
                // 斜着（或竖着）落下来，落地处用一个小圆角接到地面
                var al2 = Math.hypot(P3[0] - P2[0], P3[1] - P2[1]) || 1, ax = (P3[0] - P2[0]) / al2, ay = (P3[1] - P2[1]) / al2, rc = Math.min(3.5, al2 * 0.6);
                var E = [P3[0] - ax * rc, P3[1] - ay * rc];
                d += ' C' + n2(c1[0]) + ' ' + n2(c1[1]) + ' ' + n2(P2[0]) + ' ' + n2(P2[1]) + ' ' + n2(E[0]) + ' ' + n2(E[1]) +
                    ' Q' + n2(P3[0]) + ' ' + b + ' ' + n2(P3[0] - rc - 1) + ' ' + b;
            } else {
                d += ' C' + n2(c1[0]) + ' ' + n2(c1[1]) + ' ' + n2(fx + nose) + ' ' + b + ' ' + n2(P3[0]) + ' ' + b;
            }
        }
        return d + ' Z';
    }

    // 表情
    function circlePath(x, y, r) {
        return 'M' + n2(x - r) + ' ' + n2(y) + ' a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0';
    }
    function setEye(node, x, y, type, right) {
        var d, fill = 'none', sw = 1.5;
        if (type === 'dot') { d = circlePath(x, y, 1.4); fill = P.INK; sw = 0; }
        else if (type === 'wide') { d = circlePath(x, y, 1.75); fill = P.INK; sw = 0; }
        else if (type === 'happy') d = 'M' + n2(x - 1.7) + ' ' + n2(y + 0.7) + ' Q' + n2(x) + ' ' + n2(y - 1.7) + ' ' + n2(x + 1.7) + ' ' + n2(y + 0.7);
        else if (type === 'line') d = 'M' + n2(x - 1.6) + ' ' + n2(y + 0.3) + ' L' + n2(x + 1.6) + ' ' + n2(y + 0.3);
        else if (type === 'squeeze') d = right
            ? 'M' + n2(x + 1.3) + ' ' + n2(y - 1.4) + ' L' + n2(x - 1.2) + ' ' + n2(y) + ' L' + n2(x + 1.3) + ' ' + n2(y + 1.4)
            : 'M' + n2(x - 1.3) + ' ' + n2(y - 1.4) + ' L' + n2(x + 1.2) + ' ' + n2(y) + ' L' + n2(x - 1.3) + ' ' + n2(y + 1.4);
        node.setAttribute('d', d);
        node.setAttribute('fill', fill);
        node.setAttribute('stroke', P.INK);
        node.setAttribute('stroke-width', sw);
    }
    function setMouth(node, x, y, type, open) {
        var d, fill = 'none';
        if (type === 'smile') d = 'M' + n2(x - 1.9) + ' ' + n2(y) + ' q1.9 2 3.8 0';
        else if (type === 'open') { d = 'M' + n2(x - 1.8) + ' ' + n2(y - 0.2) + ' q1.8 ' + n2(1 + 2.4 * open) + ' 3.6 0 z'; fill = '#b4554f'; }
        else if (type === 'o') d = circlePath(x, y + 0.6, 1.1);
        else if (type === 'flat') d = 'M' + n2(x - 1.4) + ' ' + n2(y + 0.5) + ' L' + n2(x + 1.4) + ' ' + n2(y + 0.5);
        else d = 'M' + n2(x - 2.2) + ' ' + n2(y + 0.6) + ' q1.1 -1.1 2.2 0 t2.2 0';     // 'wavy'
        node.setAttribute('d', d);
        node.setAttribute('fill', fill);
        node.setAttribute('stroke', P.INK);
        node.setAttribute('stroke-width', 1.4);
    }

    // ---------- 沿屏幕边缘的路线 ----------
    var W = 0, H = 0, segs = [], LEN = 0, pos = 0;
    // 活动范围：整圈路线上的一段 [rangeLo, rangeHi]（bounded = false 表示整圈都能爬）。
    // 被拖到别处后，这段范围会跟着蜗牛一起搬过去（dragged = true）
    var bounded = false, rangeLo = 0, rangeHi = 0, rangeM = 0, dragged = false;
    var drag = null, landing = null, suppressClick = 0;
    var pose = { x: 0, y: 0, a: 0 };

    function layout() {
        W = document.documentElement.clientWidth || window.innerWidth;
        H = window.innerHeight;
        // 像素风：蜗牛的像素图分辨率固定（每格 PIX_UNIT 个单位），和窗口宽度无关 → 任何屏幕上都是同一张像素图
        var wantSize = W < 600 ? CONFIG.mobileSize : CONFIG.size;
        if (PX) {
            var dprp = window.devicePixelRatio || 1;
            PX = Math.max(1 / dprp, Math.round(wantSize / 100 * PIX_UNIT * dprp) / dprp);   // 对齐到物理像素，方块才整齐
        }
        k = PX ? PX / PIX_UNIT : wantSize / 100;
        svg.setAttribute('width', VBW * k);
        svg.setAttribute('height', VBH * k);
        root.style.transformOrigin = (AX * k) + 'px ' + (BASE * k) + 'px';

        buildPath();

        if (canvas && PX) {
            canvas.width = Math.ceil(W / PX);
            canvas.height = Math.ceil(H / PX);
            canvas.style.width = canvas.width * PX + 'px';
            canvas.style.height = canvas.height * PX + 'px';
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        } else if (canvas) {
            var dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            canvas.style.width = W + 'px';
            canvas.style.height = H + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        if (PX) {
            PN = 2 * Math.ceil(104 * k / PX);              // 画布边长（单位：像素格），足够装下任意旋转角度的蜗牛
            pcv.width = pcv.height = PN;
            pcv.style.width = pcv.style.height = PN * PX + 'px';
            wcv.width = wcv.height = PN * SS;
        }
        trail = [];
        trailDirty = true;
    }

    // 把这一圈上的位置换算成“第几圈、第几段、这一段的百分之多少”，这样路线变了（窗口大小、导航条、换页面）
    // 之后还能找回同一个地方
    function segF(p) {
        if (!LEN) return null;
        var n = Math.floor(p / LEN), q = p - n * LEN;
        for (var i = 0; i < segs.length; i++) {
            var s = segs[i];
            if (q <= s.start + s.len || i === segs.length - 1) return { n: n, i: i, f: clamp((q - s.start) / s.len, 0, 1) };
        }
        return null;
    }
    function fromSegF(o) {
        var s = segs[o.i];
        return o.n * LEN + s.start + clamp(o.f, 0, 1) * s.len;
    }

    // 路线永远是沿屏幕四条边的一整圈（转角是圆弧），活动范围只是这一圈上的一段。
    // 顶边的位置是 topInset：没有固定导航条时是 0（屏幕最上面），有的话是导航条的下沿
    function buildPath() {
        var keep = LEN ? { pos: segF(pos), lo: segF(rangeLo), hi: segF(rangeHi) } : null;
        var top = topInset, route = CONFIG.route;
        var r = Math.min(30, W / 4, (H - top) / 4), mx = W / 2, my = (top + H) / 2;
        segs = [];
        segs.push({ line: 1, x0: r, y0: H, x1: W - r, y1: H, a: 0 });                  // 底边，向右
        segs.push({ cx: W - r, cy: H - r, r: r, t0: 90, t1: 0 });
        segs.push({ line: 1, x0: W, y0: H - r, x1: W, y1: top + r, a: -90 });          // 右边，向上
        segs.push({ cx: W - r, cy: top + r, r: r, t0: 0, t1: -90 });
        segs.push({ line: 1, x0: W - r, y0: top, x1: r, y1: top, a: -180 });           // 顶边，向左（倒挂）
        segs.push({ cx: r, cy: top + r, r: r, t0: -90, t1: -180 });
        segs.push({ line: 1, x0: 0, y0: top + r, x1: 0, y1: H - r, a: -270 });         // 左边，向下
        segs.push({ cx: r, cy: H - r, r: r, t0: -180, t1: -270 });
        LEN = 0;
        segs.forEach(function (s) {
            s.len = s.line ? Math.hypot(s.x1 - s.x0, s.y1 - s.y0) : s.r * Math.PI / 2;
            s.start = LEN;
            LEN += s.len;
        });
        // 四条边各自的中点在这一圈上的位置
        var midB = segs[0].start + (mx - r), midR = segs[2].start + (H - r - my);
        var midT = segs[4].start + (W - r - mx), midL = segs[6].start + (my - top - r);
        var RANGES = {
            'bottom-right': [midB, midR], 'top-right': [midR, midT], 'top-left': [midT, midL], 'bottom-left': [midL, LEN + midB],
            'bottom': [0, segs[0].len]
        };
        bounded = route !== 'all';
        var rg = RANGES[route] || RANGES['bottom-right'];
        rangeM = route === 'bottom' ? Math.max(0, 50 * k - r) : 50 * k;                // 两头留出半只蜗牛的位置
        if (keep) pos = fromSegF(keep.pos);
        if (!bounded) {
            if (!keep) pos = W * rand(0.12, 0.3);
        } else if (dragged && keep) {
            rangeLo = fromSegF(keep.lo); rangeHi = fromSegF(keep.hi);                  // 被拖走后的活动范围原样保留
        } else {
            rangeLo = rg[0]; rangeHi = rg[1];
            pos = keep ? clamp(pos, rangeLo + rangeM, rangeHi - rangeM) : lerp(rangeLo, rangeHi, rand(0.3, 0.6));
        }
    }

    // ---------- 顶部的导航条 ----------
    var topInset = 0, topTarget = 0, topCheck = 0;
    function isTopBar(n) {
        var cs = window.getComputedStyle(n);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') return 0;
        if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
        var rc = n.getBoundingClientRect();
        // 贴着屏幕顶、横跨大半个屏幕、又不太高的固定元素，才算导航条
        return (rc.top <= 2 && rc.bottom > 4 && rc.bottom < H * 0.4 && rc.width > W * 0.5) ? rc.bottom : 0;
    }
    function detectTopBar() {
        var opt = CONFIG.topBar, best = 0, i, n;
        if (!opt) return 0;
        if (opt !== 'auto') {
            var list = document.querySelectorAll(opt);
            for (i = 0; i < list.length; i++) best = Math.max(best, isTopBar(list[i]));
            return Math.round(best);
        }
        if (!document.elementsFromPoint) return 0;
        var xs = [0.2, 0.5, 0.8];
        for (var xi = 0; xi < xs.length; xi++) {
            var els = document.elementsFromPoint(W * xs[xi], 2);
            for (i = 0; i < els.length && i < 8; i++) {
                for (n = els[i]; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
                    if (typeof n.className === 'string' && /(^|\s)snl-(root|bar|panel|pix|trail|say|z|foam|poop)(\s|$)/.test(n.className)) break;     // 蜗牛自己的东西
                    var bt = isTopBar(n);
                    if (bt) { best = Math.max(best, bt); break; }
                }
            }
        }
        return Math.round(best);
    }
    // 每帧调用：导航条出现 / 消失 / 变高时，顶边平滑地移过去，趴在顶边的蜗牛也跟着移动
    function updateTopBar(dt, now) {
        if (now - topCheck > 250) {
            topCheck = now;
            var seen = detectTopBar();
            if (seen !== topTarget) { topTarget = seen; placeInfo(); }
        }
        if (topInset === topTarget) return;
        var next = topInset + (topTarget - topInset) * (1 - Math.exp(-12 * dt));
        topInset = Math.abs(topTarget - next) < 0.5 ? topTarget : next;
        buildPath();
    }

    // ---------- 每位访客自己的数据（存在他自己的浏览器里）：只有他给蜗牛选的帽子 ----------
    var ME_KEY = 'cuteSnail:me';
    var me = { hat: undefined };
    function loadMe(extra) {
        var d = null;
        try { d = JSON.parse(window.localStorage.getItem(ME_KEY)); } catch (e) {}
        if (extra && typeof extra === 'object' && (!d || !d.t || (extra.t || 0) > d.t)) d = extra;   // 本地文件打开时，从上一个页面带过来的那份
        if (d && typeof d === 'object') me = { hat: d.hat, t: d.t };      // 只取帽子（旧版本存过的互动次数和日记不再使用）
    }
    function saveMe() {
        me.t = Date.now();
        try { window.localStorage.setItem(ME_KEY, JSON.stringify(me)); } catch (e) {}
    }
    function setHat(id) {
        id = HATS[id] ? id : '';
        if (id === currentHat()) return;
        me.hat = id;
        saveMe();
        rebuildHatSvg();
        refreshPanel(true);
    }

    // ---------- 角落的信息条 + 信息面板（档案 / 衣柜） ----------
    var bar = null, panel = null, UI = {}, curTab = 'info', inNav = false;
    var BORN = new Date(CONFIG.born).getTime();
    if (isNaN(BORN)) BORN = Date.now();
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function lived() { return Math.max(0, Date.now() - BORN); }
    function fmtAge(ms) {
        var sec = Math.floor(ms / 1000), d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
        return (d ? d + ' 天 ' : '') + (d || h ? h + ' 小时 ' : '') + m + ' 分 ' + pad2(sec % 60) + ' 秒';
    }
    function fmtDate(t, withTime) {
        var d = new Date(t), str = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
        return withTime ? pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : str;
    }
    function nowDoing() {
        if (busy) return ({ eat: '在吃叶子', poop: '在拉便便', chirp: '在叫', startle: '吓得躲进了壳里', foam: '生气了，躲在壳里吐泡泡',
            wake: '刚睡醒', held: '被你拿起来了', landed: '躲在壳里观察情况' })[busy.name] || '在发呆';
        return ({ crawl: '在爬', rest: '在休息', explore: '在东张西望', sleep: '在睡觉', turn: '在掉头', curious: '在看你的鼠标' })[state.name] || '在发呆';
    }
    function mk(tag, cls, text, parent) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined && text !== null) n.textContent = text;
        if (parent) parent.appendChild(n);
        return n;
    }
    function buildInfo() {
        if (!CONFIG.infoBar) return;
        var list = CONFIG.infoBar === 'nav' ? document.querySelector(CONFIG.navList) : null;
        inNav = !!list;
        if (inNav) {
            // 放进导航栏：做成和其他导航项一样的 <li><a>，样式跟着导航栏走
            var li = mk(/^(ul|ol)$/i.test(list.tagName) ? 'li' : 'span', 'snl-navitem', null, list);
            bar = mk('a', 'snl-navlink', null, li);
            bar.setAttribute('role', 'button');
            bar.setAttribute('tabindex', '0');
            bar.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bar.click(); } });
        } else {
            bar = mk('button', 'snl-bar', null, document.body);
            bar.type = 'button';
        }
        bar.setAttribute('aria-expanded', 'false');
        mk('span', 'snl-dot', null, bar);
        UI.barText = mk('span', '', '', bar);
        bar.addEventListener('click', function (e) { e.preventDefault(); if (panel.classList.contains('snl-open')) closePanel(); else openPanel(); });

        panel = mk('div', 'snl-panel', null, document.body);
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', CONFIG.name + '的信息');
        var tabs = mk('div', 'snl-tabs', null, panel);
        UI.tabs = {}; UI.pages = {};
        [['info', '档案'], ['hats', '衣柜']].forEach(function (t) {
            var b = UI.tabs[t[0]] = mk('button', 'snl-tab', t[1], tabs);
            b.type = 'button';
            b.addEventListener('click', function () { showTab(t[0]); });
        });
        var x = mk('button', 'snl-close', '×', tabs);
        x.type = 'button'; x.setAttribute('aria-label', '关闭');
        x.addEventListener('click', closePanel);

        // 档案：照片 + 名字 + 生活了多久 + 现在在做什么
        var pg = UI.pages.info = mk('div', 'snl-page', null, panel);
        var pol = mk('div', 'snl-polaroid', null, pg);
        UI.photo = mk('canvas', 'snl-photo', null, pol);
        UI.photo.width = 48; UI.photo.height = 36;
        UI.cap = mk('div', 'snl-cap', '', pol);
        mk('div', 'snl-name', CONFIG.name, pg);
        mk('div', 'snl-dim', '本站居民 · 蜗牛 · 生日 ' + fmtDate(BORN), pg);
        mk('div', 'snl-dim', '已经在这里生活了', pg).style.marginTop = '6px';
        UI.age = mk('div', 'snl-age', '', pg);
        var nowRow = mk('div', '', null, pg);
        mk('span', 'snl-dim', '现在：', nowRow);
        UI.now = mk('span', '', '', nowRow);

        // 衣柜
        pg = UI.pages.hats = mk('div', 'snl-page', null, panel);
        UI.hats = mk('div', 'snl-hats', null, pg);
        //mk('div', 'snl-dim snl-small', '帽子只存在你自己的浏览器里，别人看到的还是它原来的样子。', pg).style.marginTop = '10px';

        document.addEventListener('pointerdown', function (e) {       // 点面板外面就收起来
            if (panel.classList.contains('snl-open') && !panel.contains(e.target) && !bar.contains(e.target)) closePanel();
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
        window.setInterval(tickInfo, 1000);
        placeInfo();
        tickInfo();
    }
    function placeInfo() {
        if (!bar) return;
        var gap = 12;
        if (inNav) {
            // 在导航栏里：面板从这一项的正下方垂下来，右边缘对齐这一项（放不下就贴着屏幕边）
            var rc = bar.getBoundingClientRect();
            if (!rc.width && !rc.height) { closePanel(); return; }        // 这一项被收起来了（比如手机上折叠的菜单）
            var top = Math.max(gap, rc.bottom + 8), pw = Math.min(252, W - 2 * gap);
            panel.style.top = top + 'px';
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
            panel.style.left = clamp(rc.right - pw, gap, Math.max(gap, W - pw - gap)) + 'px';
            panel.style.maxHeight = 'calc(100vh - ' + (top + gap) + 'px)';
            panel.style.overflowY = 'auto';
            return;
        }
        // 固定在屏幕的一个角上；顶部有导航条时让开它
        var where = String(CONFIG.infoBar), topSide = where.indexOf('top') === 0, right = where.indexOf('right') > 0;
        var v = topSide ? Math.round(topTarget) + gap : gap;
        [bar, panel].forEach(function (n, i) {
            n.style.left = right ? 'auto' : gap + 'px';
            n.style.right = right ? gap + 'px' : 'auto';
            n.style.top = topSide ? (v + (i ? 36 : 0)) + 'px' : 'auto';
            n.style.bottom = topSide ? 'auto' : (v + (i ? 36 : 0)) + 'px';
        });
        panel.style.maxHeight = 'calc(100vh - ' + (v + 48) + 'px)';
        panel.style.overflowY = 'auto';
    }
    function tickInfo() {
        if (!bar) return;
        var ms = lived(), day = Math.floor(ms / 86400000) + 1;
        UI.barText.textContent = inNav ? CONFIG.name : CONFIG.name + ' · 第 ' + day + ' 天';     // 导航栏里只显示名字
        if (!panel.classList.contains('snl-open')) return;
        if (inNav) placeInfo();
        if (!panel.classList.contains('snl-open')) return;
        UI.age.textContent = fmtAge(ms);
        UI.now.textContent = state ? nowDoing() : '';
    }
    function showTab(name) {
        curTab = name;
        for (var key in UI.tabs) {
            UI.tabs[key].classList.toggle('snl-on', key === name);
            UI.pages[key].classList.toggle('snl-on', key === name);
        }
        refreshPanel(true);
    }
    function openPanel() {
        if (!panel) return;
        placeInfo();
        panel.classList.add('snl-open'); bar.classList.add('snl-open');
        bar.setAttribute('aria-expanded', 'true');
        showTab(curTab);
        tickInfo();
    }
    function closePanel() {
        if (!panel) return;
        panel.classList.remove('snl-open'); bar.classList.remove('snl-open');
        bar.setAttribute('aria-expanded', 'false');
    }
    // 面板开着的时候，把当前这一页的内容刷新一下（photo = 是否重新拍照）
    function refreshPanel(photo) {
        if (!panel || !panel.classList.contains('snl-open')) return;
        if (curTab === 'info') {
            if (photo && SH) takePhoto(UI.photo);
            UI.cap.textContent = CONFIG.name + ' · 第 ' + (Math.floor(lived() / 86400000) + 1) + ' 天';
        } else {
            UI.hats.textContent = '';
            var cur = currentHat();
            [''].concat(Object.keys(HATS)).forEach(function (id) {
                var b = mk('button', 'snl-hat' + (id === cur ? ' snl-on' : ''), null, UI.hats);
                b.type = 'button';
                b.setAttribute('aria-pressed', id === cur ? 'true' : 'false');
                if (id) b.appendChild(hatCanvas(id, 4)); else mk('span', 'snl-none', '—', b);
                mk('span', '', id ? HATS[id].name : '不戴', b);
                b.addEventListener('click', function () { setHat(id); });
            });
        }
    }

    // ---------- 换页面时记住状态 ----------
    var SAVE_KEY = 'cuteSnail:', lastSave = 0, forgot = false;
    function saveState() {
        if (!CONFIG.remember || forgot || !LEN || !state) return;
        var held = busy && /^(held|landed|startle|foam)$/.test(busy.name);
        var data = {
            v: 1, t: Date.now(),
            pos: segF(pos), lo: segF(rangeLo), hi: segF(rangeHi), dragged: dragged,
            flip: S.flip >= 0 ? 1 : -1,
            out: held ? 0 : S.out, ext: S.ext, lift: S.lift, tl: S.tl, low: S.low, epi: S.epi,
            state: (busy || state.name === 'turn' || state.name === 'curious') ? 'rest' : state.name,
            st: busy ? 0 : state.t, sd: busy ? 1.5 : state.dur,
            food: lastFood, poop: poopTimer, me: me
        };
        var str = JSON.stringify(data);
        try { window.sessionStorage.setItem(SAVE_KEY, str); } catch (e) {}
        // 直接双击打开本地文件（file://）时，有的浏览器不让两个页面共用存储，所以再用 window.name 带一份过去
        try { if (!window.name || window.name.indexOf(SAVE_KEY) === 0) window.name = SAVE_KEY + str; } catch (e) {}
    }
    function loadState() {
        if (!CONFIG.remember) return null;
        var best = null;
        function tryParse(str) {
            try {
                var d = JSON.parse(str);
                if (d && d.v === 1 && d.pos && typeof d.pos.i === 'number' && (!best || d.t > best.t)) best = d;
            } catch (e) {}
        }
        try { var a = window.sessionStorage.getItem(SAVE_KEY); if (a) tryParse(a); } catch (e) {}
        try { if (window.name && window.name.indexOf(SAVE_KEY) === 0) tryParse(window.name.slice(SAVE_KEY.length)); } catch (e) {}
        return best;
    }
    function restoreState(d) {
        dragged = !!d.dragged;
        if (segs[d.pos.i]) pos = fromSegF(d.pos);
        if (bounded) {
            if (dragged && d.lo && d.hi && segs[d.lo.i] && segs[d.hi.i]) { rangeLo = fromSegF(d.lo); rangeHi = fromSegF(d.hi); }
            pos = clamp(pos, rangeLo + rangeM, rangeHi - rangeM);
        }
        S.flip = d.flip < 0 ? -1 : 1;
        S.out = +d.out || 0; S.ext = +d.ext || 0.5; S.lift = +d.lift || 0; S.low = +d.low || 0; S.epi = +d.epi || 0;
        if (d.tl && d.tl.length === 2) S.tl = [+d.tl[0] || 0, +d.tl[1] || 0];
        setState(DUR[d.state] ? d.state : 'rest');
        state.t = +d.st || 0;
        state.dur = +d.sd || state.dur;
        lastFood = d.food || null;
        poopTimer = typeof d.poop === 'number' ? d.poop : -1;
    }

    function pointAt(p) {
        p = ((p % LEN) + LEN) % LEN;
        for (var i = 0; i < segs.length; i++) {
            var s = segs[i];
            if (p <= s.start + s.len || i === segs.length - 1) {
                var f = clamp((p - s.start) / s.len, 0, 1);
                if (s.line) return { x: lerp(s.x0, s.x1, f), y: lerp(s.y0, s.y1, f), a: s.a };
                var deg = lerp(s.t0, s.t1, f), th = deg * Math.PI / 180;
                return { x: s.cx + s.r * Math.cos(th), y: s.cy + s.r * Math.sin(th), a: deg - 90 };
            }
        }
        return { x: 0, y: H, a: 0 };
    }

    // 屏幕上任意一点 → 这一圈路线上离它最近的位置
    function nearestOnLoop(x, y) {
        var best = 0, bd = 1e18;
        for (var i = 0; i < segs.length; i++) {
            var s = segs[i], f, px, py;
            if (s.line) {
                var dx = s.x1 - s.x0, dy = s.y1 - s.y0;
                f = clamp(((x - s.x0) * dx + (y - s.y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
                px = s.x0 + dx * f; py = s.y0 + dy * f;
            } else {
                var mid = (s.t0 + s.t1) / 2, ang = Math.atan2(y - s.cy, x - s.cx) / D2R;
                ang = clamp(mid + ((((ang - mid) % 360) + 540) % 360 - 180), s.t1, s.t0);
                f = (s.t0 - ang) / (s.t0 - s.t1);
                px = s.cx + s.r * Math.cos(ang * D2R); py = s.cy + s.r * Math.sin(ang * D2R);
            }
            var d = (x - px) * (x - px) + (y - py) * (y - py);
            if (d < bd) { bd = d; best = s.start + f * s.len; }
        }
        return best;
    }
    function angDiff(to, from) { return (((to - from) % 360) + 540) % 360 - 180; }

    function flipShown() {
        var f = S.flip;
        return Math.abs(f) < 0.08 ? (f < 0 ? -0.08 : 0.08) : f;
    }
    // 蜗牛坐标 -> 屏幕坐标
    function toScreen(lx, ly) {
        var ar = pose.a * Math.PI / 180, c = Math.cos(ar), s = Math.sin(ar);
        var dx = (lx - AX) * k * flipShown(), dy = (ly - BASE) * k;
        return { x: pose.x + c * dx - s * dy, y: pose.y + s * dx + c * dy };
    }
    // 屏幕坐标 -> 蜗牛坐标
    function toLocal(X, Y) {
        var ar = pose.a * Math.PI / 180, c = Math.cos(ar), s = Math.sin(ar);
        var dx = X - pose.x, dy = Y - pose.y;
        var rx = c * dx + s * dy, ry = -s * dx + c * dy;
        return { x: rx / (k * flipShown()) + AX, y: ry / k + BASE };
    }
    // 指向屏幕内侧（蜗牛“头顶上方”）的方向
    function normal() {
        var ar = pose.a * Math.PI / 180;
        return { x: Math.sin(ar), y: -Math.cos(ar) };
    }
    function tangent() {
        var ar = pose.a * Math.PI / 180, f = S.flip >= 0 ? 1 : -1;
        return { x: Math.cos(ar) * f, y: Math.sin(ar) * f };
    }

    // ---------- 状态 ----------
    var S = { out: 0, ext: 0.5, lift: 0, dip: 0, tl: [0, 0], low: 0, amp: 3, speed: 0, flip: 1, munch: 0, squeeze: 0, epi: 0 };
    var G = { hx: 60, hy: 60, tail: 20, tips: [{ x: 0, y: 0 }, { x: 0, y: 0 }] };
    var time = 0, phase = 0, wob = 0, aimW = 0, aimPt = null;
    var hold = [0, 0];
    var state = null, busy = null;
    var lastFood = null, poopTimer = -1;
    var poops = [], clicks = [];
    var mouse = { x: -1e4, y: -1e4, on: false }, mouseNear = false, mouseLocal = null;
    var hidden = false;

    var DUR = { crawl: [6, 14], rest: [3, 7], explore: [3, 6], sleep: [9, 16], turn: [99, 99], curious: [999, 999] };
    function setState(name) {
        var d = DUR[name];
        state = { name: name, t: 0, dur: rand(d[0], d[1]) };
        if (name === 'turn') state.from = S.flip >= 0 ? 1 : -1;
    }
    function nextState() {
        var n = state.name, r = Math.random();
        if (reduceMotion) { setState(r < 0.6 ? 'rest' : 'explore'); return; }
        if (n === 'crawl') setState(r < 0.38 ? 'rest' : r < 0.72 ? 'explore' : r < 0.88 ? 'turn' : 'crawl');
        else if (n === 'rest') setState(r < 0.55 ? 'crawl' : r < 0.8 ? 'explore' : 'sleep');
        else if (n === 'explore') setState(r < 0.7 ? 'crawl' : 'rest');
        else setState('crawl');
    }

    function runState(dt, t) {
        state.t += dt;
        var s = state.name;
        if (s === 'crawl') {
            t.speed = CONFIG.speed; t.ext = 0.9; t.lift = 0.12; t.amp = 6;
        } else if (s === 'rest') {
            t.ext = 0.35; t.lift = 0; t.tl0 = t.tl1 = 0.5; t.low = 0.5; t.amp = 2;
            if (!state.said && state.t > 1.5 && Math.random() < 0.003) { state.said = 1; say(pick(['…', 'ふぅ', '呼~'])); }
        } else if (s === 'explore') {
            t.ext = 1.15; t.lift = 0.35 + 0.3 * Math.sin(time * 1.4); t.tl0 = t.tl1 = 1.12; t.low = 1.2; t.amp = 20;
        } else if (s === 'sleep') {
            t.out = 0; t.tl0 = t.tl1 = 0; t.low = 0; t.epi = state.t > 2 ? 1 : 0;
            state.z = (state.z || 0) - dt;
            if (state.t > 1.8 && state.z <= 0) { state.z = 1.6; zzz(); }
        } else if (s === 'turn') {
            t.ext = 0.55; t.tl0 = t.tl1 = 0.7;
            S.flip -= state.from * dt * 1.6;
            if (state.from > 0 ? S.flip <= -1 : S.flip >= 1) { S.flip = -state.from; setState('crawl'); }
            return;
        } else if (s === 'curious') {
            t.ext = 1.1; t.lift = 0.45; t.tl0 = t.tl1 = 1.12; t.low = 1.2; t.amp = 3;
            aimTarget = mouseLocal;
            if (!mouseNear) { state.away = (state.away || 0) + dt; if (state.away > 1.4) setState('crawl'); }
            else state.away = 0;
        }
        if (state.t > state.dur) nextState();
    }

    // ---------- 点击后的反应 ----------
    function startBusy(name) {
        busy = { name: name, t: 0 };
        if (name === 'startle') {
            busy.hide = rand(2.2, 3.8); busy.dur = busy.hide + 2.6; wob = 7;
            if (Math.random() < 0.5) say(pick(['!', '!?', 'きゅ!', '嗖']));
        } else if (name === 'chirp') {
            busy.dur = 1.4; say(chirpText());
        } else if (name === 'poop') {
            busy.dur = 3;
        } else if (name === 'eat') {
            busy.dur = 4.4; startLeaf();
        } else if (name === 'foam') {
            busy.dur = 6.2; wob = 9; say(pick(['!!', 'ぷんぷん', '哼！']));
        } else if (name === 'wake') {
            busy.dur = 2.8; say(pick(['…?', 'ん?', 'zz…!?']));
        }
    }

    function runBusy(dt, t) {
        var b = busy, bt = (b.t += dt);
        if (b.name === 'chirp') {
            t.ext = 1; t.lift = 0.3 + 0.35 * Math.abs(Math.sin(bt * 7)); t.tl0 = t.tl1 = 1.1; t.amp = 10;
        } else if (b.name === 'startle') {
            if (bt < 0.3) { t.ext = 0.7; }
            else if (bt < b.hide) { t.out = 0; t.tl0 = t.tl1 = 0; t.low = 0; } else t.ext = 0.6;
        } else if (b.name === 'poop') {
            t.ext = 0.6; t.tl0 = t.tl1 = 0.8;
            t.squeeze = (bt > 0.3 && bt < 1.5) ? 1 : 0;
            if (!b.done && bt > 0.7) { b.done = 1; poop(); }
            if (!b.said && bt > 1.1) { b.said = 1; say(pick(['噗', 'pu~', '…ふう'])); }
        } else if (b.name === 'eat') {
            t.ext = 1.1; t.lift = 0; t.dip = bt < 3.8 ? 1 : 0; t.tl0 = t.tl1 = 0.9; t.amp = 4;   // 低下头去吃地上的叶子
            var BITES = [0.9, 1.5, 2.1, 2.7, 3.3];
            while (b.bites < BITES.length && bt > BITES[b.bites]) {
                el('circle', { cx: 1 + b.bites * 3.8, cy: -3, r: 3.5, fill: '#000' }, P.bites);
                b.bites++;
            }
            t.munch = (bt > 0.8 && bt < 3.6 && ((bt - 0.8) % 0.6) < 0.25) ? 1 : 0;
            if (!b.s1 && bt > 1.0) { b.s1 = 1; say('nom'); }
            if (!b.s2 && bt > 2.4) { b.s2 = 1; say('nom nom'); }
            if (!b.gone && bt > 3.6) { b.gone = 1; P.leaf.style.opacity = 0; lastFood = 'leaf'; poopTimer = rand(15, 40); }
        } else if (b.name === 'foam') {
            if (bt < 3.4) { t.out = 0; t.tl0 = t.tl1 = 0; t.low = 0; }
            b.f = (b.f || 0) - dt;
            if (bt > 0.25 && bt < 2.6 && b.f <= 0) { b.f = 0.07; foam(); }
            if (bt < 2.4) wob = Math.max(wob, 3);
        } else if (b.name === 'wake') {
            t.epi = 0; t.ext = 0.5;
        } else if (b.name === 'held') {
            // 被拿起来：先愣一下，然后缩进壳里（真的蜗牛被拿起来也会缩壳）
            if (bt < 0.22) t.ext = 0.7; else { t.out = 0; t.tl0 = t.tl1 = 0; t.low = 0; }
            wob = Math.max(wob, 1.2);
        } else if (b.name === 'landed') {
            // 放下之后：在壳里躲一会儿，再慢慢探出头来看看这是哪儿
            if (bt < 0.9) { t.out = 0; t.tl0 = t.tl1 = 0; t.low = 0; }
            else {
                t.ext = 0.7;
                if (!b.said && bt > 2.2) { b.said = 1; say(pick(['?', '…?', 'ここどこ?', '咦?', 'ん?'])); }
            }
        }
        if (bt >= b.dur) {
            busy = null;
            setState('rest');
            state.dur = 1.5;
        }
    }

    function chirpText() {
        if (Math.random() < 0.15) return pick(['…', '？', '♪']);
        var syl = ['ぷ', 'む', 'にょ', 'ぴ', 'ぽ', 'きゅ', '咕', '啵', 'mu', 'pyu', 'nyo', 'puu'];
        var end = ['~', '?', '!', '…', '♪', ''];
        var s = pick(syl);
        if (Math.random() < 0.35) s += pick(syl);
        return s + pick(end);
    }

    function startLeaf() {
        while (P.bites.firstChild) P.bites.removeChild(P.bites.firstChild);
        busy.leafX = SH.q[0] + LOOK.dx + 6 + LOOK.r - 3;
        busy.bites = 0;
        P.leaf.setAttribute('transform', 'translate(' + n2(busy.leafX) + ' ' + (BASE - 0.3) + ') scale(1.35)');
        P.leaf.style.opacity = 1;
    }

    // ---------- 拖动 ----------
    function onDown(e) {
        if (!CONFIG.drag || (e.button !== undefined && e.button !== 0) || drag) return;
        drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false, target: e.target };
        try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
    }
    function onMove(e) {
        if (!drag || e.pointerId !== drag.id) return;
        drag.x = e.clientX; drag.y = e.clientY;
        if (!drag.moved && Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > 6) {     // 移动超过 6px 才算拖动，否则还是点击
            drag.moved = true;
            landing = null;
            drag.ox = pose.x - drag.x; drag.oy = pose.y - drag.y;
            busy = { name: 'held', t: 0, dur: Infinity };
            wob = 6;
            root.classList.add('snl-dragging');
            if (Math.random() < 0.6) say(pick(['!?', 'わっ', '哇', '!']));
        }
        if (drag.moved) e.preventDefault();
    }
    function onUp(e) {
        if (!drag || e.pointerId !== drag.id) return;
        var d = drag;
        drag = null;
        try { d.target.releasePointerCapture(d.id); } catch (err) {}
        if (!d.moved) return;                         // 没有拖动 → 交给 click 事件处理
        suppressClick = performance.now();
        root.classList.remove('snl-dragging');
        // 落到离松手位置最近的屏幕边缘；活动范围也跟着搬到这里
        pos = nearestOnLoop(d.x, d.y);
        if (bounded) {
            var half = (rangeHi - rangeLo) / 2;
            rangeLo = pos - half; rangeHi = pos + half;
        }
        dragged = true;
        landing = { x0: pose.x, y0: pose.y, a0: pose.a, t: 0, dur: 0.22 };
        busy = { name: 'landed', t: 0, dur: 3.4 };
    }

    function onClick(e) {
        e.preventDefault();
        e.stopPropagation();
        var now = performance.now();
        if (now - suppressClick < 400 || (busy && (busy.name === 'held' || busy.name === 'landed'))) return;
        clicks = clicks.filter(function (t) { return now - t < 2500; });
        clicks.push(now);

        if (state.name === 'sleep' && !busy) { startBusy('wake'); return; }
        if (busy && (busy.name === 'startle' || busy.name === 'foam')) {
            wob = Math.max(wob, 5);   // 敲敲壳
            if (clicks.length >= 4 && busy.name !== 'foam') { clicks = []; startBusy('foam'); }
            return;
        }
        if (clicks.length >= 4) { clicks = []; startBusy('foam'); return; }

        // 点到眼柄尖：只缩回那一根
        var L = toLocal(e.clientX, e.clientY);
        for (var i = 0; i < 2; i++) {
            if (S.tl[i] > 0.4 && Math.hypot(L.x - G.tips[i].x, L.y - G.tips[i].y) < 7) {
                hold[i] = 2;
                if (Math.random() < 0.5) say(pick(['!', 'ひゃ', '!?']));
                return;
            }
        }
        if (busy) return;

        var r = Math.random();
        var pPoop = lastFood === 'leaf' ? 0.35 : 0.18;
        if (r < pPoop) startBusy('poop');
        else if (r < pPoop + 0.32) startBusy('chirp');
        else if (r < pPoop + 0.58) startBusy('startle');
        else startBusy('eat');
    }

    // ---------- 特效：对话气泡 / zzz / 泡沫 / 便便 ----------
    function say(text) {
        var hp = toScreen(G.hx, G.hy - 12), n = normal();
        var x = clamp(hp.x + n.x * 22, 30, W - 30), y = clamp(hp.y + n.y * 22, 16, H - 16);
        var d = document.createElement('div');
        d.className = 'snl-say';
        d.textContent = text;
        d.style.left = x + 'px';
        d.style.top = y + 'px';
        document.body.appendChild(d);
        var fx = n.x * 14, fy = n.y * 14, base = 'translate(-50%,-50%) ';
        animate(d, [
            { transform: base + 'scale(0)', opacity: 1 },
            { transform: base + 'scale(1.15)', opacity: 1, offset: 0.12 },
            { transform: base + 'scale(1)', opacity: 1, offset: 0.2 },
            { transform: base + 'translate(' + fx * 0.6 + 'px,' + fy * 0.6 + 'px) scale(1)', opacity: 1, offset: 0.8 },
            { transform: base + 'translate(' + fx + 'px,' + fy + 'px) scale(.9)', opacity: 0 }
        ], 1900);
    }

    function zzz() {
        var p = toScreen(SH.cx + 4, SH.top + 3), n = normal(), tg = tangent();
        var d = document.createElement('div');
        d.className = 'snl-z';
        d.textContent = pick(['z', 'Z', 'z']);
        d.style.fontSize = Math.round(rand(11, 16)) + 'px';
        d.style.left = p.x + 'px';
        d.style.top = p.y + 'px';
        document.body.appendChild(d);
        var dx = n.x * 30 - tg.x * 14, dy = n.y * 30 - tg.y * 14, base = 'translate(-50%,-50%) ';
        animate(d, [
            { transform: base + 'scale(.4)', opacity: 0 },
            { transform: base + 'translate(' + dx * 0.3 + 'px,' + dy * 0.3 + 'px) scale(1)', opacity: 1, offset: 0.25 },
            { transform: base + 'translate(' + dx + 'px,' + dy + 'px) scale(1.1)', opacity: 0 }
        ], 2400);
    }

    function foam() {
        var p = toScreen(SH.q[0] - 3 + rand(-3, 3), (SH.q[1] + SH.yb) / 2 + rand(-3, 3)), n = normal(), tg = tangent();
        var size = rand(4, 9) * k * 1.1;
        var d = document.createElement('div');
        d.className = 'snl-foam';
        d.style.left = p.x + 'px';
        d.style.top = p.y + 'px';
        d.style.width = d.style.height = size + 'px';
        document.body.appendChild(d);
        var out = rand(6, 26), side = rand(-18, 18);
        var dx = n.x * out + tg.x * side, dy = n.y * out + tg.y * side, base = 'translate(-50%,-50%) ';
        animate(d, [
            { transform: base + 'scale(.2)', opacity: 1 },
            { transform: base + 'translate(' + dx + 'px,' + dy + 'px) scale(1)', opacity: 1, offset: 0.75 },
            { transform: base + 'translate(' + dx + 'px,' + dy + 'px) scale(1.4)', opacity: 0 }
        ], rand(900, 1700));
    }

    // 蜗牛的肛门在壳口附近（靠近头），所以便便从壳的前下方出来；颜色取决于吃了什么
    function poop() {
        var color = lastFood === 'leaf' ? '#6e9b3f' : pick(['#7a5534', '#7a5534', '#c9782f', '#6e9b3f']);
        lastFood = null;
        var pt = toScreen(SH.q[0] - 3, BASE - 2.4);
        if (PX) { poopPixel(color, pt); return; }
        var s = el('svg', { 'class': 'snl-poop', width: 30 * k, height: 10 * k, viewBox: '-24 -5 30 10' });
        var pd = 'M0 0 c-2 -1.6 -3.6 1.4 -5.6 0 s-3.6 1.3 -5.6 0 s-3.4 1.2 -5.2 0';
        var outline = el('path', { d: pd, fill: 'none', stroke: '#2f2219', 'stroke-width': 4, 'stroke-linecap': 'round', pathLength: 1 }, s);
        var path = el('path', { d: pd, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', pathLength: 1 }, s);
        [outline, path].forEach(function (pp) {
            pp.style.strokeDasharray = '1';
            pp.style.strokeDashoffset = '1';
            pp.style.transition = 'stroke-dashoffset 1.3s ease-out';
        });
        s.style.transformOrigin = (24 * k) + 'px ' + (5 * k) + 'px';
        s.style.transform = 'translate(' + (pt.x - 24 * k) + 'px,' + (pt.y - 5 * k) + 'px) rotate(' + pose.a + 'deg) scaleX(' + (S.flip >= 0 ? 1 : -1) + ')';
        document.body.appendChild(s);
        requestAnimationFrame(function () { requestAnimationFrame(function () {
            outline.style.strokeDashoffset = '0';
            path.style.strokeDashoffset = '0';
        }); });
        poops.push(s);
        if (poops.length > 6) removeEl(poops.shift());
        setTimeout(function () {
            s.style.opacity = 0;
            setTimeout(function () { removeEl(s); poops = poops.filter(function (x) { return x !== s; }); }, 2100);
        }, 20000);
    }

    function animate(node, frames, ms) {
        if (node.animate) {
            var a = node.animate(frames, { duration: ms, easing: 'ease-out', fill: 'forwards' });
            a.onfinish = function () { removeEl(node); };
        } else {
            setTimeout(function () { removeEl(node); }, ms);
        }
    }
    function removeEl(n) { if (n && n.parentNode) n.parentNode.removeChild(n); }

    // ---------- 黏液痕迹 ----------
    var trail = [], trailDirty = false;
    function addTrail(now) {
        var p = toScreen(G.tail + 4, BASE - 0.4);
        var l = trail[trail.length - 1];
        var dist = l ? Math.hypot(p.x - l.x, p.y - l.y) : 1e9;
        if (dist < 3) return;
        trail.push({ x: p.x, y: p.y, t: now, brk: dist > 25 });
    }
    function drawTrail(now) {
        if (!ctx) return;
        while (trail.length && now - trail[0].t > TRAIL_MS) trail.shift();
        if (!trail.length && !trailDirty) return;
        trailDirty = trail.length > 0;
        if (PX) { drawTrailPixel(now); return; }
        ctx.clearRect(0, 0, W, H);
        ctx.lineCap = 'butt';
        for (var i = 1; i < trail.length; i++) {
            var a = trail[i - 1], b = trail[i];
            if (b.brk) continue;
            var al = 0.3 * (1 - (now - b.t) / TRAIL_MS);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = 'rgba(170,200,228,' + al + ')';
            ctx.lineWidth = 5 * k;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(1, al * 1.8) + ')';
            ctx.lineWidth = 1.2 * k;
            ctx.stroke();
        }
    }

    // ---------- 像素画渲染 ----------
    // 做法：把（隐藏的）矢量蜗牛按 SS 倍分辨率画到一块小画布上，再把每 SS×SS 个采样点合并成一个像素，
    // 颜色只从固定的调色板里选 → 得到边缘干净、没有半透明过渡的像素画。所有动画和表情都自动保留。
    var SS = 4, pcv, pctx, wcv, wctx, PN = 0;
    var PAL = ['#231a14', '#efe1cf', '#a87a5d', '#c49b7c', '#e9cfb2', '#f0a19c', '#7f9f6c', '#b4554f', '#fbf6ea', '#5b3f2e',
               '#7a5534', '#c9782f', '#6e9b3f'].map(function (h) {
        return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
    });
    var palCache = new Int8Array(32768), palLoose = new Int8Array(32768);
    for (var pci = 0; pci < 32768; pci++) { palCache[pci] = -2; palLoose[pci] = -2; }
    // 返回最接近的调色板颜色；strict 时，如果是两种颜色混出来的过渡色（离谁都不近）就返回 -1
    function nearestPal(r, g, b, strict) {
        var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3), cache = strict ? palCache : palLoose, v = cache[key];
        if (v !== -2) return v;
        var best = 0, bd = 1e9;
        for (var i = 0; i < PAL.length; i++) {
            var dr = r - PAL[i][0], dg = g - PAL[i][1], db = b - PAL[i][2], dd = dr * dr + dg * dg + db * db;
            if (dd < bd) { bd = dd; best = i; }
        }
        palLoose[key] = best;
        palCache[key] = bd < 500 ? best : -1;
        return strict ? palCache[key] : best;
    }
    // 把 SS 倍分辨率的画面合并成 N×N 的调色板索引（-1 = 透明）
    function quantize(src, N) {
        var WS = N * SS, sd = src.getImageData(0, 0, WS, WS).data, idx = new Int8Array(N * N);
        var cnt = new Uint16Array(PAL.length), tot = SS * SS;
        for (var j = 0; j < N; j++) {
            for (var i = 0; i < N; i++) {
                var opaque = 0, pure = 0, ar = 0, ag = 0, ab = 0, p, q;
                for (p = 0; p < PAL.length; p++) cnt[p] = 0;
                for (var sy = 0; sy < SS; sy++) {
                    var o = ((j * SS + sy) * WS + i * SS) * 4;
                    for (var sx = 0; sx < SS; sx++, o += 4) {
                        if (sd[o + 3] > 140) {
                            opaque++; ar += sd[o]; ag += sd[o + 1]; ab += sd[o + 2];
                            q = nearestPal(sd[o], sd[o + 1], sd[o + 2], true);
                            if (q >= 0) { cnt[q]++; pure++; }
                        }
                    }
                }
                var pk = -1;
                if (opaque) {
                    if (cnt[0] >= tot * 0.28) pk = 0;                  // 描边优先，保证黑线不断
                    else if (opaque >= tot * 0.5) {
                        if (pure) { for (p = 0; p < PAL.length; p++) if (pk < 0 || cnt[p] > cnt[pk]) pk = p; }
                        else pk = nearestPal(ar / opaque | 0, ag / opaque | 0, ab / opaque | 0, false);
                    }
                }
                idx[j * N + i] = pk;
            }
        }
        // 补描边：有颜色的像素如果直接挨着透明像素，就把那个透明像素涂成黑色 → 轮廓线一定是连续的
        var add = [];
        for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
            if (idx[y * N + x] !== -1) continue;
            if ((x > 0 && idx[y * N + x - 1] > 0) || (x < N - 1 && idx[y * N + x + 1] > 0) ||
                (y > 0 && idx[(y - 1) * N + x] > 0) || (y < N - 1 && idx[(y + 1) * N + x] > 0)) add.push(y * N + x);
        }
        for (var ai = 0; ai < add.length; ai++) idx[add[ai]] = 0;
        return idx;
    }
    function blit(idx, N, dst) {
        var out = dst.createImageData(N, N), od = out.data;
        for (var i = 0; i < idx.length; i++) {
            var pk = idx[i];
            if (pk >= 0) {
                var col = pk >= 64 ? HATPAL[pk - 64] : PAL[pk];
                od[i * 4] = col[0]; od[i * 4 + 1] = col[1]; od[i * 4 + 2] = col[2]; od[i * 4 + 3] = 255;
            }
        }
        dst.putImageData(out, 0, 0);
    }

    // 像素五官：每种表情一套像素图案（坐标以头的中心为原点，单位是像素格，脸朝右）
    var PIX_EYES = {
        dot:     [[0, -1], [0, 0], [3, -1], [3, 0]],
        wide:    [[-1, -1], [0, -1], [-1, 0], [0, 0], [3, -1], [4, -1], [3, 0], [4, 0]],
        line:    [[-1, 0], [0, 0], [3, 0], [4, 0]],
        happy:   [[-1, 0], [0, -1], [3, -1], [4, 0]],
        squeeze: [[-1, -1], [0, 0], [-1, 1], [4, -1], [3, 0], [4, 1]]
    };
    var PIX_MOUTH = {
        smile: { c: 0, p: [[1, 2], [2, 2]] },
        flat:  { c: 0, p: [[1, 2], [2, 2]] },
        open:  { c: 7, p: [[1, 1], [2, 1], [1, 2], [2, 2]] },
        o:     { c: 0, p: [[2, 1], [2, 2]] },
        wavy:  { c: 0, p: [[1, 2], [2, 1]] }
    };
    var PIX_BLUSH = [[-2, 1], [-1, 1], [4, 1]];
    // c：这一张像素图的摆法 —— N 边长、sc 每个单位多少格、ca/sa 旋转、fl 左右翻转、ax/ay 脚底中心所在的格子
    function cellOf(c, lx, ly) {
        var x = lx * c.fl;
        return [Math.floor(c.ax + c.ca * x - c.sa * ly), Math.floor(c.ay + c.sa * x + c.ca * ly)];
    }
    function pixelFace(idx, c) {
        if (S.out < 0.8) return;
        var N = c.N, hcx = Math.round((G.hx - AX) * c.sc), hcy = Math.round((G.hy - BASE) * c.sc);
        function put(ox, oy, color) {
            var q = cellOf(c, hcx + ox + 0.5, hcy + oy + 0.5);
            if (q[0] < 0 || q[1] < 0 || q[0] >= N || q[1] >= N) return;
            var cur = idx[q[1] * N + q[0]];
            if (cur === 1 || cur === 5) idx[q[1] * N + q[0]] = color;       // 只画在脸（肤色）上
        }
        var fc = face(), i;
        for (i = 0; i < PIX_BLUSH.length; i++) put(PIX_BLUSH[i][0], PIX_BLUSH[i][1], 5);
        var ey = PIX_EYES[fc.e] || PIX_EYES.dot;
        for (i = 0; i < ey.length; i++) put(ey[i][0], ey[i][1], 0);
        var mo = PIX_MOUTH[fc.m] || PIX_MOUTH.smile;
        if (fc.m === 'open' && fc.open < 0.35) mo = PIX_MOUTH.smile;
        for (i = 0; i < mo.p.length; i++) put(mo.p[i][0], mo.p[i][1], mo.c);
    }

    // ---------- 帽子 ----------
    // 每顶帽子是一小张像素图：一行字符串是一行像素，字母对应下面的颜色，'.' 是透明。想加新帽子照着加一项就行
    var HATCOL = { K: '#231a14', Y: '#e8c46a', y: '#c39a3e', R: '#d9534f', W: '#fbf6ea', B: '#5b7fc4', G: '#86a86c', g: '#5d7d4c',
                   P: '#f0a19c', O: '#f2c84b', D: '#3f3f4c', d: '#5a5a6a' };
    var HATS = {
        straw:  { name: '草帽',   px: ['...KKKKK...', '..KYYYYYK..', '..KRRRRRK..', 'KKYYYYYYYKK', 'KyyyyyyyyyK', '.KKKKKKKKK.'] },
        top:    { name: '礼帽',   px: ['..KKKKK..', '..KDdDK..', '..KDdDK..', '..KRRRK..', 'KKKDDDKKK', 'KDDDDDDDK', '.KKKKKKK.'] },
        crown:  { name: '皇冠',   px: ['K..K.K..K', 'KK.KOK.KK', 'KOKOOOKOK', 'KOROBOROK', 'KKKKKKKKK'] },
        bow:    { name: '蝴蝶结', px: ['KK...KK', 'KRK.KRK', 'KRRKRRK', 'KRK.KRK', 'KK...KK'], dy: 1 },
        party:  { name: '派对帽', px: ['...K...', '..KOK..', '..KPK..', '.KPBPK.', '.KBPBK.', 'KPBPBPK', 'KKKKKKK'] },
        sprout: { name: '小芽',   px: ['.KK...KK.', 'KGGK.KGGK', 'KGgGKGgGK', '.KKgKgKK.', '...KgK...', '...KgK...'] }
    };
    var HATKEYS = Object.keys(HATCOL), HATPAL = HATKEYS.map(function (ch) {
        var h = HATCOL[ch];
        return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
    });
    function currentHat() {
        var h = me.hat !== undefined && me.hat !== null ? me.hat : (CONFIG.hat || '');
        return HATS[h] ? h : '';
    }
    // 把帽子画到像素格上：平时戴在头顶；缩进壳里的时候，帽子留在壳顶上
    function pixelHat(idx, c) {
        var hat = HATS[currentHat()];
        if (!hat) return;
        var N = c.N, w = hat.px[0].length, h = hat.px.length, bx, by;
        if (S.out >= 0.8) { bx = Math.round((G.hx - AX) * c.sc) - 1; by = Math.round((G.hy - BASE) * c.sc) - 5 + (hat.dy || 0); }
        else { bx = Math.round((SH.cx - AX) * c.sc) + 1; by = Math.round((SH.top + 2.5 - BASE) * c.sc) + 1; }
        for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
            var ch = hat.px[j].charAt(i);
            if (ch === '.') continue;
            var q = cellOf(c, bx - Math.floor(w / 2) + i + 0.5, by - h + j + 0.5);
            if (q[0] < 0 || q[1] < 0 || q[0] >= N || q[1] >= N) continue;
            idx[q[1] * N + q[0]] = 64 + HATKEYS.indexOf(ch);
        }
    }
    function hatCanvas(id, scale) {          // 一顶帽子的小图标
        var hat = HATS[id], cv = document.createElement('canvas'), w = hat.px[0].length, h = hat.px.length;
        cv.width = w; cv.height = h;
        cv.style.width = w * scale + 'px'; cv.style.height = h * scale + 'px';
        var x = cv.getContext('2d');
        for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
            var ch = hat.px[j].charAt(i);
            if (ch !== '.') { x.fillStyle = HATCOL[ch]; x.fillRect(i, j, 1, 1); }
        }
        return cv;
    }
    function rebuildHatSvg() {               // 手绘风时的帽子：用一个个小方块拼出来
        while (P.hat.firstChild) P.hat.removeChild(P.hat.firstChild);
        var hat = HATS[currentHat()];
        if (!hat || PX) return;
        for (var j = 0; j < hat.px.length; j++) for (var i = 0; i < hat.px[j].length; i++) {
            var ch = hat.px[j].charAt(i);
            if (ch !== '.') el('rect', { x: i, y: j, width: 1.02, height: 1.02, fill: HATCOL[ch] }, P.hat);
        }
    }

    function applyTf(c, str) {
        var re = /(translate|rotate|scale)\(([^)]*)\)/g, m;
        while ((m = re.exec(str))) {
            var a = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
            if (m[1] === 'translate') c.translate(a[0], a[1] || 0);
            else if (m[1] === 'scale') c.scale(a[0], a.length > 1 ? a[1] : a[0]);
            else if (a.length > 2) { c.translate(a[1], a[2]); c.rotate(a[0] * D2R); c.translate(-a[1], -a[2]); }
            else c.rotate(a[0] * D2R);
        }
    }
    // 把一个 SVG 节点（和它的子节点）按当前的属性画到 canvas 上
    function paintNode(c, node, alpha) {
        if (node.nodeType !== 1) return;
        var tag = node.tagName.toLowerCase();
        if (tag === 'defs') return;
        // CSS 的 opacity 优先于属性（和浏览器渲染 SVG 的规则一致）
        var oa = (node.style && node.style.opacity !== '') ? node.style.opacity : node.getAttribute('opacity');
        var op = alpha * (oa === null ? 1 : parseFloat(oa));
        if (!(op > 0.03) || node.getAttribute('visibility') === 'hidden') return;
        c.save();
        var tf = node.getAttribute('transform');
        if (tf) applyTf(c, tf);
        if (tag === 'g') {
            for (var i = 0; i < node.childNodes.length; i++) paintNode(c, node.childNodes[i], op);
            if (node.getAttribute('mask') === 'url(#snl-leafmask)') {       // 叶子被咬掉的缺口
                c.globalCompositeOperation = 'destination-out'; c.globalAlpha = 1; c.fillStyle = '#000';
                for (var bi = 0; bi < P.bites.childNodes.length; bi++) {
                    var bn = P.bites.childNodes[bi];
                    c.beginPath(); c.arc(+bn.getAttribute('cx'), +bn.getAttribute('cy'), +bn.getAttribute('r'), 0, 6.2832); c.fill();
                }
                c.globalCompositeOperation = 'source-over';
            }
        } else {
            var path = null;
            if (tag === 'path') { var d = node.getAttribute('d'); if (d) path = new Path2D(d); }
            else if (tag === 'circle') { var cr = +node.getAttribute('r'); if (cr > 0) { path = new Path2D(); path.arc(+node.getAttribute('cx'), +node.getAttribute('cy'), cr, 0, 6.2832); } }
            else if (tag === 'ellipse') {
                var erx = +node.getAttribute('rx'), ery = +node.getAttribute('ry');
                if (erx > 0 && ery > 0) { path = new Path2D(); path.ellipse(+node.getAttribute('cx'), +node.getAttribute('cy'), erx, ery, 0, 0, 6.2832); }
            } else if (tag === 'line') {
                path = new Path2D(); path.moveTo(+node.getAttribute('x1'), +node.getAttribute('y1')); path.lineTo(+node.getAttribute('x2'), +node.getAttribute('y2'));
            }
            if (path) {
                c.globalAlpha = op;
                var fill = node.getAttribute('fill');
                if (fill && fill.charAt(0) === '#') { c.fillStyle = fill; c.fill(path); }
                var st = node.getAttribute('stroke'), sw = parseFloat(node.getAttribute('stroke-width'));
                if (st && st !== 'none' && sw > 0) {
                    c.strokeStyle = st; c.lineWidth = sw;
                    c.lineCap = node.getAttribute('stroke-linecap') || 'butt';
                    c.lineJoin = node.getAttribute('stroke-linejoin') || 'miter';
                    c.stroke(path);
                }
            }
        }
        c.restore();
    }

    // 把当前的蜗牛画成一张 N×N 的像素图（返回调色板索引）
    function renderSprite(work, wc, N, sc, angDeg, fl, ax, ay) {
        var sp = sc * SS;
        wc.setTransform(1, 0, 0, 1, 0, 0);
        wc.clearRect(0, 0, work.width, work.height);
        wc.translate(ax * SS, ay * SS);
        wc.rotate(angDeg * D2R);
        wc.scale(fl * sp, sp);
        wc.translate(-AX, -BASE);
        var pv = P.face.getAttribute('visibility'), ph = P.hat.getAttribute('visibility');
        P.face.setAttribute('visibility', 'hidden');            // 五官和帽子不走矢量，后面直接按像素画
        P.hat.setAttribute('visibility', 'hidden');
        paintNode(wc, P.art, 1);
        if (pv === null) P.face.removeAttribute('visibility'); else P.face.setAttribute('visibility', pv);
        if (ph === null) P.hat.removeAttribute('visibility'); else P.hat.setAttribute('visibility', ph);
        var ar = angDeg * D2R, c = { N: N, sc: sc, ca: Math.cos(ar), sa: Math.sin(ar), fl: fl, ax: ax, ay: ay };
        var idx = quantize(wc, N);
        pixelFace(idx, c);
        pixelHat(idx, c);
        return idx;
    }

    function paintPixels() {
        var half = PN / 2;
        // 蜗牛的位置对齐到像素格 → 像素不会在移动时闪烁；旋转画在画布里面 → 爬到侧边、转角时像素依然是横平竖直的
        var ax = Math.round(pose.x / PX), ay = Math.round(pose.y / PX);
        pcv.style.transform = 'translate(' + ((ax - half) * PX) + 'px,' + ((ay - half) * PX) + 'px)';
        blit(renderSprite(wcv, wctx, PN, k / PX, pose.a, flipShown(), half, half), PN, pctx);
    }

    // 给菜菜拍一张照片：摆一个标准的爬行姿势（戴着现在的帽子），画到信息面板里的相框上
    var photoWork = null, photoTmp = null;
    function takePhoto(target) {
        var N = 48;
        if (!photoWork) {
            photoWork = document.createElement('canvas'); photoWork.width = photoWork.height = N * SS;
            photoTmp = document.createElement('canvas'); photoTmp.width = photoTmp.height = N;
        }
        // 暂时把姿势换成“标准照”，拍完再换回来（同一帧内完成，屏幕上的蜗牛不受影响）
        var keep = { S: S, state: state, busy: busy, hold: hold, blinking: blinking };
        S = { out: 1, ext: 0.9, lift: 0.12, dip: 0, tl: [1, 1], low: 1, amp: 0, speed: 0, flip: 1, munch: 0, squeeze: 0, epi: 0 };
        state = { name: 'crawl', t: 0, dur: 9 }; busy = null; hold = [0, 0]; blinking = 0;
        render();
        var idx = renderSprite(photoWork, photoWork.getContext('2d', { willReadFrequently: true }), N, 1 / PIX_UNIT, 0, 1, 24, 41);
        S = keep.S; state = keep.state; busy = keep.busy; hold = keep.hold; blinking = keep.blinking;
        render();
        blit(idx, N, photoTmp.getContext('2d'));
        var x = target.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.fillStyle = '#e4efd6'; x.fillRect(0, 0, 48, 36);                 // 背景
        x.fillStyle = '#f3f8ea'; x.fillRect(5, 5, 9, 3); x.fillRect(8, 3, 5, 2); x.fillRect(30, 8, 10, 3); x.fillRect(33, 6, 5, 2);   // 两朵云
        x.fillStyle = '#c5d9ac'; x.fillRect(0, 33, 48, 3);                 // 草地
        x.fillStyle = '#a9c48c'; x.fillRect(3, 32, 1, 1); x.fillRect(11, 32, 1, 1); x.fillRect(40, 32, 1, 1); x.fillRect(45, 32, 1, 1);
        x.drawImage(photoTmp, 0, 8, 48, 36, 0, 0, 48, 36);
    }

    function drawTrailPixel(now) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var cells = {}, key, i;
        for (i = 0; i < trail.length; i++) {
            var age = (now - trail[i].t) / TRAIL_MS, lvl = age < 0.34 ? 3 : age < 0.67 ? 2 : 1;
            var gx = Math.round(trail[i].x / PX), gy = Math.round(trail[i].y / PX);
            for (var yy = -1; yy <= 1; yy++) for (var xx = -1; xx <= 1; xx++) {
                key = (gx + xx) + ',' + (gy + yy);
                if (!(cells[key] >= lvl)) cells[key] = lvl;
            }
        }
        for (key in cells) {
            var xy = key.split(',');
            ctx.fillStyle = cells[key] === 3 ? 'rgba(176,206,232,.6)' : cells[key] === 2 ? 'rgba(176,206,232,.4)' : 'rgba(176,206,232,.22)';
            ctx.fillRect(+xy[0], +xy[1], 1, 1);
        }
    }

    function poopPixel(color, pt) {
        var N = 2 * Math.ceil(26 * k / PX), half = N / 2, s = k / PX * SS;
        var pc = document.createElement('canvas'), wc = document.createElement('canvas');
        pc.className = 'snl-poop';
        pc.width = pc.height = N; wc.width = wc.height = N * SS;
        pc.style.width = pc.style.height = N * PX + 'px';
        var c = wc.getContext('2d');
        c.translate(half * SS, half * SS); c.rotate(pose.a * D2R); c.scale((S.flip >= 0 ? 1 : -1) * s, s);
        var pp = new Path2D('M0 0 c-2 -1.6 -3.6 1.4 -5.6 0 s-3.6 1.3 -5.6 0 s-3.4 1.2 -5.2 0');
        c.lineCap = 'round';
        c.strokeStyle = '#231a14'; c.lineWidth = 4.4; c.stroke(pp);
        c.strokeStyle = color; c.lineWidth = 2.2; c.stroke(pp);
        blit(quantize(c, N), N, pc.getContext('2d'));
        pc.style.transform = 'translate(' + ((Math.round(pt.x / PX) - half) * PX) + 'px,' + ((Math.round(pt.y / PX) - half) * PX) + 'px)';
        document.body.appendChild(pc);
        poops.push(pc);
        if (poops.length > 6) removeEl(poops.shift());
        setTimeout(function () {
            pc.style.opacity = 0;
            setTimeout(function () { removeEl(pc); poops = poops.filter(function (x) { return x !== pc; }); }, 2100);
        }, 20000);
    }

    // ---------- 每帧更新 ----------
    var aimTarget = null;
    function update(dt, now) {
        var t = { out: 1, ext: 0.8, lift: 0.1, dip: 0, tl0: 1, tl1: 1, low: 1, amp: 5, speed: 0, epi: 0, munch: 0, squeeze: 0 };
        aimTarget = null;

        // 鼠标靠近：好奇地用眼柄探测；碰到眼柄尖就缩回
        mouseNear = false;
        if (canHover && mouse.on && S.out > 0.8 && !(state.name === 'sleep')) {
            mouseLocal = toLocal(mouse.x, mouse.y);
            mouseNear = Math.hypot(mouseLocal.x - G.hx, mouseLocal.y - (G.hy - 6)) * k < 110;
            for (var i = 0; i < 2; i++) {
                if (S.tl[i] > 0.3 && Math.hypot(mouseLocal.x - G.tips[i].x, mouseLocal.y - G.tips[i].y) < 6) {
                    if (hold[i] <= 0 && Math.random() < 0.3) say('!');
                    hold[i] = 1.4;
                }
            }
            if (mouseNear && !busy && /^(crawl|rest|explore)$/.test(state.name)) setState('curious');
        }

        // 吃过叶子后，过一阵子会自己拉便便
        if (poopTimer > 0) {
            poopTimer -= dt;
            if (poopTimer <= 0) {
                if (!busy && state.name !== 'sleep' && state.name !== 'turn') startBusy('poop');
                else poopTimer = 3;
            }
        }

        if (busy) runBusy(dt, t); else runState(dt, t);

        for (var j = 0; j < 2; j++) {
            if (hold[j] > 0) { hold[j] -= dt; t['tl' + j] = 0; }
        }

        S.out = approach(S.out, t.out, 1.3, 12, dt);           // 伸出慢，缩回快
        S.ext = approach(S.ext, t.ext, 2.5, 4, dt);
        S.lift = approach(S.lift, t.lift, 2.5, 2.5, dt);
        S.dip = approach(S.dip, t.dip, 2.6, 3, dt);
        S.tl[0] = approach(S.tl[0], t.tl0, 1.1, 16, dt);       // 眼柄：缩回很快，再伸出来很慢
        S.tl[1] = approach(S.tl[1], t.tl1, 1.0, 16, dt);
        S.low = approach(S.low, t.low, 1.5, 10, dt);
        S.amp = approach(S.amp, t.amp, 1.5, 1.5, dt);
        S.speed = approach(S.speed, t.speed, 1.2, 4, dt);
        S.epi = approach(S.epi, t.epi, 0.8, 3, dt);
        S.munch = approach(S.munch, t.munch, 18, 18, dt);
        S.squeeze = approach(S.squeeze, t.squeeze, 6, 4, dt);
        aimW = approach(aimW, aimTarget ? 1 : 0, 4, 3, dt);
        if (aimTarget) aimPt = aimTarget;
        wob *= Math.exp(-2.2 * dt);
        blinkT -= dt; blinking -= dt;
        if (blinkT <= 0) { blinking = 0.14; blinkT = rand(2.5, 5.5); }

        var dir = S.flip >= 0 ? 1 : -1;
        if (S.speed > 0.05 && S.out > 0.9) {
            pos += dir * S.speed * dt;
            phase += dt * 2.6 * (S.speed / Math.max(1, CONFIG.speed));
            if (!bounded) pos = ((pos % LEN) + LEN) % LEN;
        }
        if (bounded) {
            var lo = rangeLo + rangeM, hi = rangeHi - rangeM;
            if (pos < lo) { pos = lo; if (state.name === 'crawl' && dir < 0) setState('turn'); }
            if (pos > hi) { pos = hi; if (state.name === 'crawl' && dir > 0) setState('turn'); }
        }
        if (drag && drag.moved) {
            // 被拖着：捏着壳跟着指针走，身体的朝向慢慢转向最近的那条边（预览它会落在哪儿）
            var np = pointAt(nearestOnLoop(drag.x, drag.y));
            var na = pose.a + angDiff(np.a, pose.a) * (1 - Math.exp(-9 * dt));
            var nr = na * D2R, lx = (SH.cx - AX) * k * flipShown(), ly = (SH.cy - BASE) * k;
            var tx0 = -(Math.cos(nr) * lx - Math.sin(nr) * ly), ty0 = -(Math.sin(nr) * lx + Math.cos(nr) * ly);
            var bl = 1 - Math.exp(-10 * dt);
            drag.ox += (tx0 - drag.ox) * bl; drag.oy += (ty0 - drag.oy) * bl;
            pose = { x: drag.x + drag.ox, y: drag.y + drag.oy, a: na };
        } else if (landing) {
            // 松手：滑到最近的屏幕边缘上
            landing.t += dt;
            var lu = clamp(landing.t / landing.dur, 0, 1), lf = 1 - Math.pow(1 - lu, 3), tg = pointAt(pos);
            pose = { x: lerp(landing.x0, tg.x, lf), y: lerp(landing.y0, tg.y, lf), a: landing.a0 + angDiff(tg.a, landing.a0) * lf };
            if (lu >= 1) { landing = null; wob = 7; pose = tg; }
        } else {
            pose = pointAt(pos);
        }
        if (S.speed > 0.5 && S.out > 0.9 && !landing && !(drag && drag.moved)) addTrail(now);   // 被拖着的时候不留黏液
    }

    function drawStalk(i, bx, by, ang, len, ph, st) {
        var sway = S.amp * Math.sin(time * (1.3 + i * 0.4) + ph) + S.amp * 0.4 * Math.sin(time * 3.1 + ph * 2);
        var a = ang + sway;
        if (aimW > 0.01 && aimPt) {
            var aa = clamp(Math.atan2(aimPt.y - by, aimPt.x - bx) * 180 / Math.PI, -150, -5);
            a = lerp(a, aa + sway * 0.15, aimW);
        }
        var r = a * Math.PI / 180;
        var tx = bx + Math.cos(r) * len, ty = by + Math.sin(r) * len;
        var bend = 0.16 * len * Math.sin(time * 1.9 + ph);
        var cx = (bx + tx) / 2 - Math.sin(r) * bend, cy = (by + ty) / 2 + Math.cos(r) * bend;
        var d = 'M' + n2(bx) + ' ' + n2(by) + ' Q' + n2(cx) + ' ' + n2(cy) + ' ' + n2(tx) + ' ' + n2(ty);
        st.o.setAttribute('d', d);
        st.f.setAttribute('d', d);
        var kr = 2.9 * clamp(len / 8, 0, 1);                 // 圆球头，随触角缩短一起变小
        st.ko.setAttribute('cx', n2(tx)); st.ko.setAttribute('cy', n2(ty)); st.ko.setAttribute('r', n2(kr > 0.3 ? kr + 1.4 : 0));
        st.kf.setAttribute('cx', n2(tx)); st.kf.setAttribute('cy', n2(ty)); st.kf.setAttribute('r', n2(kr));
        G.tips[i] = { x: tx, y: ty };
    }

    // 根据当前状态决定表情
    var blinkT = 3, blinking = 0;
    function face() {
        var e = 'dot', m = 'smile', open = 0;
        if (busy) {
            var bt = busy.t;
            if (busy.name === 'chirp') { m = 'open'; open = Math.abs(Math.sin(bt * 9)); }
            else if (busy.name === 'eat') { e = 'happy'; if (S.munch > 0.4) { m = 'open'; open = S.munch * 0.6; } }
            else if (busy.name === 'poop') { if (bt < 1.6) { e = 'squeeze'; m = 'wavy'; } else { e = 'happy'; } }
            else if (busy.name === 'startle') { e = 'wide'; m = 'o'; }
            else if (busy.name === 'foam') { e = 'squeeze'; m = 'wavy'; }
            else if (busy.name === 'wake') { e = 'line'; m = 'o'; }
            else if (busy.name === 'held' || busy.name === 'landed') { e = 'wide'; m = 'o'; }
        } else {
            var n = state.name;
            if (n === 'rest') e = 'line';
            else if (n === 'explore') { e = 'wide'; if (Math.sin(time * 0.9) > 0.6) m = 'o'; }
            else if (n === 'curious') { e = 'wide'; m = 'o'; }
        }
        if (hold[0] > 0.9 || hold[1] > 0.9) { e = 'squeeze'; m = 'wavy'; }   // 眼柄被碰到
        if ((e === 'dot' || e === 'wide') && blinking > 0) e = 'line';
        return { e: e, m: m, open: open };
    }

    function render() {
        var m = clamp(S.speed / Math.max(1, CONFIG.speed), 0, 1);
        var ext = S.ext;                                                // 爬行时身体保持不动，不伸缩
        var L = LOOK, Q = SH.q, fs = L.r / 12;
        var hxO = Q[0] + L.dx + (ext - 0.9) * 10 + S.dip * 4 + S.munch * 1.4;
        var hyO = lerp(Q[1] - L.dy - S.lift * 6, BASE - L.r - 1.2, S.dip) + S.munch * 0.8;
        var tailO = SH.back - 4;
        var o = S.out;
        var hx = lerp(SH.ax, hxO, o), hy = lerp(SH.ay, hyO, o), tx = lerp(SH.cx, tailO, o);
        G.hx = hx; G.hy = hy; G.tail = tx;

        var bodyOp = clamp(o * 5, 0, 1);
        P.body.setAttribute('d', bodyPath(tx, hx, hy));
        P.body.setAttribute('opacity', bodyOp);

        // 腹足上的波纹
        for (var i = 0; i < 3; i++) {
            var u = (phase * 0.35 + i / 3) % 1;
            var sx = tx + 10 + u * Math.max(0, Q[0] + L.foot - tx - 12);
            var ln = P.sole[i];
            ln.setAttribute('x1', n2(sx)); ln.setAttribute('x2', n2(sx + 3.5));
            ln.setAttribute('y1', BASE - 1.5); ln.setAttribute('y2', BASE - 1.5);
            ln.setAttribute('opacity', n2(0.35 * m * bodyOp));
        }

        // 壳：爬行时轻轻晃，受惊时抖动，拉便便时用力
        var bob = 1.3 * Math.sin(phase * 2) * m;
        var wobA = wob * Math.sin(time * 20);
        var sq = S.squeeze;
        var shellTf = 'translate(0 ' + n2((1 - o) * 2.5 + sq * 0.6) + ') rotate(' + n2(bob + wobA - sq * 2.5) + ' ' + SHX + ' ' + (BASE - 3) + ')' +
            ' translate(' + SHX + ' ' + BASE + ') scale(' + n2(1 + sq * 0.04) + ' ' + n2(1 - sq * 0.05) + ') translate(' + (-SHX) + ' ' + (-BASE) + ')';
        P.shell.setAttribute('transform', shellTf);
        P.shellIn.setAttribute('transform', shellTf);
        P.epi.setAttribute('opacity', n2(S.epi * 0.95));

        // 脸
        var faceOp = clamp((o - 0.6) / 0.4, 0, 1);
        var fc = face();
        P.face.setAttribute('opacity', n2(faceOp));
        P.blushL.setAttribute('cx', n2(hx - 2.6 * fs)); P.blushL.setAttribute('cy', n2(hy + 3.4 * fs));
        P.blushR.setAttribute('cx', n2(hx + 9.6 * fs)); P.blushR.setAttribute('cy', n2(hy + 2.8 * fs));
        setEye(P.eyeL, hx + 1.4 * fs, hy - 1 * fs, fc.e, false);
        setEye(P.eyeR, hx + 7.4 * fs, hy - 1.4 * fs, fc.e, true);
        setMouth(P.mouth, hx + 4.6 * fs, hy + 3.2 * fs, fc.m, fc.open);
        if (!PX) {
            var hatDef = HATS[currentHat()];
            if (hatDef) {
                var hw = hatDef.px[0].length, hh = hatDef.px.length, U = PIX_UNIT;
                var hbx = o >= 0.8 ? hx - U : SH.cx + U, hby = o >= 0.8 ? hy - 5 * U + (hatDef.dy || 0) * U : SH.top + 2.5 + U;
                P.hat.setAttribute('transform', 'translate(' + n2(hbx - Math.floor(hw / 2) * U) + ' ' + n2(hby - hh * U) + ') scale(' + U + ')');
            }
        }

        // 触角：身体完全伸出来之后才慢慢展开
        var vis = clamp((o - 0.55) / 0.45, 0, 1);
        drawStalk(0, hx + 3.5 * fs, hy - 8 * fs, -62, 14 * S.tl[0] * vis, 0, P.nearStalk);
        drawStalk(1, hx - 2.5 * fs, hy - 8.5 * fs, -86, 13 * S.tl[1] * vis, 1.7, P.farStalk);
        [P.nearStalk, P.farStalk].forEach(function (st) {
            [st.o, st.f, st.ko, st.kf].forEach(function (e) { e.setAttribute('opacity', n2(bodyOp)); });
        });

        root.style.transform = 'translate(' + n2(pose.x - AX * k) + 'px,' + n2(pose.y - BASE * k) + 'px) rotate(' + n2(pose.a) + 'deg) scaleX(' + n2(flipShown()) + ')';
    }

    var last = 0;
    function frame(now) {
        if (!last) last = now;
        var dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (!hidden) {
            time += dt;
            updateTopBar(dt, now);
            update(dt, now);
            render();
            if (now - lastSave > 500) { lastSave = now; saveState(); }
            if (PX) paintPixels();
            drawTrail(now);
        }
        requestAnimationFrame(frame);
    }

    function init() {
        build();
        W = document.documentElement.clientWidth || window.innerWidth;
        H = window.innerHeight;
        topInset = topTarget = detectTopBar();         // 页面一打开就有固定导航条的话，直接从它的下沿算起
        layout();
        var saved = loadState();
        loadMe(saved && saved.me);
        rebuildHatSvg();
        buildInfo();
        if (saved) {
            restoreState(saved);                       // 从上一个页面接着来
        } else {
            setState('rest');
            state.dur = 2.5;                           // 第一次出现：缩在壳里，然后慢慢探出头来
        }
        pose = pointAt(pos);
        render();

        window.addEventListener('resize', function () {
            layout();
            poops.forEach(removeEl);
            poops = [];
            if (panel && panel.classList.contains('snl-open')) placeInfo();
        });
        window.addEventListener('mousemove', function (e) {
            mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true;
        }, { passive: true });
        document.addEventListener('mouseleave', function () { mouse.on = false; });
        window.addEventListener('scroll', function () {
            topCheck = 0;                                              // 滚动后马上重新看一眼导航条
            if (panel && panel.classList.contains('snl-open')) placeInfo();
        }, { passive: true });
        window.addEventListener('pagehide', saveState);
        window.addEventListener('beforeunload', saveState);
        document.addEventListener('visibilitychange', function () { if (document.hidden) saveState(); });

        requestAnimationFrame(frame);
    }

    // 小接口：在控制台里可以用 CuteSnail.act('poop') 等手动触发，CuteSnail.hide()/show() 隐藏或显示
    window.CuteSnail = {
        act: function (name) {
            if (name === 'sleep' || name === 'crawl' || name === 'rest' || name === 'explore' || name === 'turn') { busy = null; setState(name); }
            else if (/^(chirp|startle|poop|eat|foam|wake)$/.test(name)) startBusy(name);
        },
        forget: function () {          // 清掉记住的状态，下次打开页面时蜗牛从默认位置重新开始
            forgot = true;
            try { window.sessionStorage.removeItem(SAVE_KEY); } catch (e) {}
            try { if (window.name.indexOf(SAVE_KEY) === 0) window.name = ''; } catch (e) {}
        },
        hide: function () {
            hidden = true;
            [root, canvas, pcv].concat(poops).forEach(function (n) { if (n) n.style.display = 'none'; });
        },
        show: function () {
            hidden = false;
            [root, canvas, pcv].concat(poops).forEach(function (n) { if (n) n.style.display = ''; });
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
