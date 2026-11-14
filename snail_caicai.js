/*!
 * snail.js — 网页边缘的小蜗牛装饰
 * 用法：在页面 </body> 前加一行  <script src="snail.js"></script>
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
        speed: 2,         // 爬行速度（px/秒）
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
            cx: p.cx, a1: a1, a2: a2,
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
        '.snl-hit{pointer-events:visiblePainted;cursor:pointer}',
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
    var PX = CONFIG.pixel ? 2 : 0;                         // 每个“像素格”在屏幕上的大小（px），在 layout() 里按 size 计算；0 = 不用像素风
    var PIX_UNIT = 2.174;                                  // 一个像素格对应多少蜗牛单位（头的直径 ≈ 12 格）

    // ---------- 构建 SVG ----------
    var root, svg, canvas, ctx, P = {};

    function build() {
        var style = document.createElement('style');
        style.textContent = CSS + (PX ? '\n' + CSS_PIXEL : '');
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
        P.INK = INK;

        svg.addEventListener('click', onClick);
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
    var W = 0, H = 0, segs = [], LEN = 0, loop = true, pos = 0;
    var pose = { x: 0, y: 0, a: 0 };

    function layout() {
        var oldLen = LEN;
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

        var route = CONFIG.route, r = Math.min(30, W / 4, H / 4), mx = W / 2, my = H / 2;
        loop = route === 'all';
        segs = [];
        if (loop) {
            segs.push({ line: 1, x0: r, y0: H, x1: W - r, y1: H, a: 0 });          // 底边，向右
            segs.push({ cx: W - r, cy: H - r, r: r, t0: 90, t1: 0 });
            segs.push({ line: 1, x0: W, y0: H - r, x1: W, y1: r, a: -90 });        // 右边，向上
            segs.push({ cx: W - r, cy: r, r: r, t0: 0, t1: -90 });
            segs.push({ line: 1, x0: W - r, y0: 0, x1: r, y1: 0, a: -180 });       // 上边，向左（倒挂）
            segs.push({ cx: r, cy: r, r: r, t0: -90, t1: -180 });
            segs.push({ line: 1, x0: 0, y0: r, x1: 0, y1: H - r, a: -270 });       // 左边，向下
            segs.push({ cx: r, cy: H - r, r: r, t0: -180, t1: -270 });
        } else if (route === 'bottom') {
            segs.push({ line: 1, x0: 0, y0: H, x1: W, y1: H, a: 0 });
        } else if (route === 'bottom-left') {     // 左下 1/4：左边的下半段 + 底边的左半段
            segs.push({ line: 1, x0: 0, y0: my, x1: 0, y1: H - r, a: -270 });
            segs.push({ cx: r, cy: H - r, r: r, t0: -180, t1: -270 });
            segs.push({ line: 1, x0: r, y0: H, x1: mx, y1: H, a: -360 });
        } else if (route === 'top-right') {       // 右上 1/4：右边的上半段 + 顶边的右半段
            segs.push({ line: 1, x0: W, y0: my, x1: W, y1: r, a: -90 });
            segs.push({ cx: W - r, cy: r, r: r, t0: 0, t1: -90 });
            segs.push({ line: 1, x0: W - r, y0: 0, x1: mx, y1: 0, a: -180 });
        } else if (route === 'top-left') {        // 左上 1/4：顶边的左半段 + 左边的上半段
            segs.push({ line: 1, x0: mx, y0: 0, x1: r, y1: 0, a: -180 });
            segs.push({ cx: r, cy: r, r: r, t0: -90, t1: -180 });
            segs.push({ line: 1, x0: 0, y0: r, x1: 0, y1: my, a: -270 });
        } else {                                  // 右下 1/4（默认）：底边的右半段 + 右边的下半段
            segs.push({ line: 1, x0: mx, y0: H, x1: W - r, y1: H, a: 0 });
            segs.push({ cx: W - r, cy: H - r, r: r, t0: 90, t1: 0 });
            segs.push({ line: 1, x0: W, y0: H - r, x1: W, y1: my, a: -90 });
        }
        LEN = 0;
        segs.forEach(function (s) {
            s.len = s.line ? Math.hypot(s.x1 - s.x0, s.y1 - s.y0) : s.r * Math.PI / 2;
            s.start = LEN;
            LEN += s.len;
        });
        pos = oldLen ? pos / oldLen * LEN : (loop ? W * rand(0.12, 0.3) : LEN * rand(0.2, 0.45));

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

    function pointAt(p) {
        if (loop) p = ((p % LEN) + LEN) % LEN;
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

    function onClick(e) {
        e.preventDefault();
        e.stopPropagation();
        var now = performance.now();
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
            if (pk >= 0) { od[i * 4] = PAL[pk][0]; od[i * 4 + 1] = PAL[pk][1]; od[i * 4 + 2] = PAL[pk][2]; od[i * 4 + 3] = 255; }
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
    function pixelFace(idx, N) {
        if (S.out < 0.8) return;
        var sc = k / PX, f = 1, half = N / 2;
        var hcx = Math.round((G.hx - AX) * sc), hcy = Math.round((G.hy - BASE) * sc);
        var ar = pose.a * D2R, ca = Math.cos(ar), sa = Math.sin(ar), fl = flipShown();
        function put(ox, oy, color) {
            var lx = (hcx + Math.round(ox * f) + 0.5) * fl, ly = hcy + Math.round(oy * f) + 0.5;
            var X = Math.floor(half + ca * lx - sa * ly), Y = Math.floor(half + sa * lx + ca * ly);
            if (X < 0 || Y < 0 || X >= N || Y >= N) return;
            var cur = idx[Y * N + X];
            if (cur === 1 || cur === 5) idx[Y * N + X] = color;       // 只画在脸（肤色）上
        }
        var fc = face(), i;
        for (i = 0; i < PIX_BLUSH.length; i++) put(PIX_BLUSH[i][0], PIX_BLUSH[i][1], 5);
        var ey = PIX_EYES[fc.e] || PIX_EYES.dot;
        for (i = 0; i < ey.length; i++) put(ey[i][0], ey[i][1], 0);
        var mo = PIX_MOUTH[fc.m] || PIX_MOUTH.smile;
        if (fc.m === 'open' && fc.open < 0.35) mo = PIX_MOUTH.smile;
        for (i = 0; i < mo.p.length; i++) put(mo.p[i][0], mo.p[i][1], mo.c);
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

    function paintPixels() {
        var s = k / PX * SS, half = PN / 2;
        // 蜗牛的位置对齐到像素格 → 像素不会在移动时闪烁；旋转画在画布里面 → 爬到侧边、转角时像素依然是横平竖直的
        var ax = Math.round(pose.x / PX), ay = Math.round(pose.y / PX);
        pcv.style.transform = 'translate(' + ((ax - half) * PX) + 'px,' + ((ay - half) * PX) + 'px)';
        wctx.setTransform(1, 0, 0, 1, 0, 0);
        wctx.clearRect(0, 0, wcv.width, wcv.height);
        wctx.translate(half * SS, half * SS);
        wctx.rotate(pose.a * D2R);
        wctx.scale(flipShown() * s, s);
        wctx.translate(-AX, -BASE);
        P.face.setAttribute('visibility', 'hidden');            // 五官不走矢量，后面直接按像素画
        paintNode(wctx, P.art, 1);
        var idx = quantize(wctx, PN);
        pixelFace(idx, PN);
        blit(idx, PN, pctx);
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
            if (loop) pos = ((pos % LEN) + LEN) % LEN;
        }
        if (!loop) {
            var m = 50 * k;
            if (pos < m) { pos = m; if (state.name === 'crawl' && dir < 0) setState('turn'); }
            if (pos > LEN - m) { pos = LEN - m; if (state.name === 'crawl' && dir > 0) setState('turn'); }
        }
        pose = pointAt(pos);
        if (S.speed > 0.5) addTrail(now);
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
            update(dt, now);
            render();
            if (PX) paintPixels();
            drawTrail(now);
        }
        requestAnimationFrame(frame);
    }

    function init() {
        build();
        layout();
        setState('rest');
        state.dur = 2.5;           // 一开始缩在壳里，然后慢慢探出头来
        pose = pointAt(pos);
        render();

        window.addEventListener('resize', function () {
            layout();
            poops.forEach(removeEl);
            poops = [];
        });
        window.addEventListener('mousemove', function (e) {
            mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true;
        }, { passive: true });
        document.addEventListener('mouseleave', function () { mouse.on = false; });

        requestAnimationFrame(frame);
    }

    // 小接口：在控制台里可以用 CuteSnail.act('poop') 等手动触发，CuteSnail.hide()/show() 隐藏或显示
    window.CuteSnail = {
        act: function (name) {
            if (name === 'sleep' || name === 'crawl' || name === 'rest' || name === 'explore' || name === 'turn') { busy = null; setState(name); }
            else if (/^(chirp|startle|poop|eat|foam|wake)$/.test(name)) startBusy(name);
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
