// 博客共用脚本（blog.html 和 post.html 都会用到），一般不需要修改。
//
// 每篇文章是 posts/<id>.js，内容格式：
//   blogPost({ title, date, tags, summary }, function () {/*
//     这里写 Markdown 正文
//   */});
// 正文里可以自由使用 ``` 代码块、反引号等，唯一不能出现的是 "*/"。
(function () {
    var registry = [];

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // 去掉每行共同的缩进，避免整段被 Markdown 当成代码块
    function dedent(text) {
        var lines = text.replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n');
        var min = Infinity;
        lines.forEach(function (l) {
            if (l.trim()) min = Math.min(min, l.match(/^[ \t]*/)[0].length);
        });
        if (!isFinite(min) || min === 0) return lines.join('\n');
        return lines.map(function (l) { return l.slice(min); }).join('\n');
    }

    // 从 function () {/* ... */} 里取出注释中的 Markdown
    function extractMarkdown(body) {
        if (typeof body === 'string') return dedent(body);
        if (typeof body !== 'function') return '';
        var s = body.toString();
        var a = s.indexOf('/*'), b = s.lastIndexOf('*/');
        return (a >= 0 && b > a) ? dedent(s.slice(a + 2, b)) : '';
    }

    function stripMarkdown(text) {
        return text
            .replace(/!\[[^\]]*\]\([^)]*\)/g, '')          // 图片
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')       // 链接 -> 文字
            .replace(/`([^`]*)`/g, '$1')                   // 行内代码
            .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, '$2')    // 粗体/斜体/删除线
            .replace(/<[^>]+>/g, '')                       // HTML 标签
            .replace(/\s+/g, ' ')
            .trim();
    }

    // 正文中第一个普通段落（跳过标题、列表、代码块、引用、表格等），作为自动摘要
    function firstParagraph(md, max) {
        max = max || 160;
        var inCode = false, para = [];
        var lines = md.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var s = lines[i].trim();
            if (/^(```|~~~)/.test(s)) {
                inCode = !inCode;
                if (para.length) break;
                continue;
            }
            if (inCode) continue;
            if (!s) { if (para.length) break; continue; }
            if (/^(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\||<|---|\*\*\*|\$\$)/.test(s)) {
                if (para.length) break;
                continue;
            }
            para.push(s);
        }
        var summary = stripMarkdown(para.join(' '));
        return summary.length > max ? summary.slice(0, max).replace(/\s+$/, '') + '…' : summary;
    }

    // 每篇文章文件调用这个函数登记自己；文章 id 就是文件名
    window.blogPost = function (meta, body) {
        meta = meta || {};
        var src = document.currentScript ? document.currentScript.getAttribute('src') : '';
        var id = decodeURIComponent((src || '').split('/').pop().replace(/\.js(\?.*)?$/i, ''));
        var markdown = extractMarkdown(body);
        registry.push({
            id: id,
            title: meta.title || id,
            date: meta.date || '',
            tags: meta.tags || [],
            summary: meta.summary || firstParagraph(markdown),
            markdown: markdown
        });
    };

    // 用 <script> 加载 posts/<id>.js（file:// 下也能用），全部加载完后回调
    function loadPosts(ids, done) {
        var left = ids.length;
        if (!left) { done([]); return; }
        ids.forEach(function (id) {
            var s = document.createElement('script');
            s.src = 'posts/' + encodeURIComponent(id) + '.js';
            s.onload = s.onerror = function () {
                if (--left === 0) done(registry.slice());
            };
            document.body.appendChild(s);
        });
    }

    function metaHtml(post) {
        return '<div class="post-meta"><i class="fa fa-calendar"></i> ' + esc(post.date) +
            post.tags.map(function (t) { return '<span class="post-tag">' + esc(t) + '</span>'; }).join('') +
            '</div>';
    }

    function renderMarkdown(md) {
        return (typeof marked !== 'undefined') ? marked.parse(md) : '<pre>' + esc(md) + '</pre>';
    }

    window.Blog = {
        esc: esc,
        loadPosts: loadPosts,
        metaHtml: metaHtml,
        renderMarkdown: renderMarkdown
    };
})();
