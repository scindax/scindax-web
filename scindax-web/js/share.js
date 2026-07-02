/* Barra de compartilhamento dos artigos: copiar link e abrir
   WhatsApp/LinkedIn/Facebook com a URL e o título da página atual. */
(function () {
    'use strict';

    function buildShareLinks(url, title) {
        const encodedUrl = encodeURIComponent(url);
        const encodedTitle = encodeURIComponent(title);
        return {
            whatsapp: 'https://api.whatsapp.com/send?text=' + encodedTitle + '%20' + encodedUrl,
            linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl,
            facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl
        };
    }

    function showCopyFeedback(btn) {
        const label = btn.querySelector('.share-btn-text');
        if (!label) return;
        const prev = label.textContent;
        label.textContent = 'Link copiado!';
        btn.classList.add('is-copied');
        setTimeout(function () {
            label.textContent = prev;
            btn.classList.remove('is-copied');
        }, 2000);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            const temp = document.createElement('textarea');
            temp.value = text;
            temp.style.position = 'fixed';
            temp.style.opacity = '0';
            document.body.appendChild(temp);
            temp.select();
            try {
                document.execCommand('copy');
                resolve();
            } catch (err) {
                reject(err);
            } finally {
                document.body.removeChild(temp);
            }
        });
    }

    function initShareBar() {
        const bar = document.querySelector('.article-share-bar');
        if (!bar) return;

        const url = window.location.href;
        const title = document.title;
        const links = buildShareLinks(url, title);

        bar.querySelectorAll('[data-share]').forEach(function (el) {
            const type = el.getAttribute('data-share');
            if (type === 'copy') {
                el.addEventListener('click', function () {
                    copyToClipboard(url).then(function () {
                        showCopyFeedback(el);
                    });
                });
            } else if (links[type]) {
                el.setAttribute('href', links[type]);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShareBar);
    } else {
        initShareBar();
    }
})();
