/* Navegação: estado da navbar no scroll e rolagem suave interna
   ao clicar nos links de âncora (#secao), descontando a altura da navbar. */
(function () {
    'use strict';

    function initNavbarScrollState() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }, { passive: true });
    }

    function initSmoothAnchors() {
        const navbar = document.getElementById('navbar');
        document.querySelectorAll('a[href^="#"]').forEach(function (link) {
            link.addEventListener('click', function (e) {
                const id = link.getAttribute('href');
                if (!id || id === '#') return;
                const target = document.querySelector(id);
                if (!target) return;
                e.preventDefault();
                const navH = navbar ? navbar.offsetHeight : 0;
                const top = target.getBoundingClientRect().top + window.pageYOffset - navH - 12;
                window.scrollTo({ top: top < 0 ? 0 : top, behavior: 'smooth' });
            });
        });
    }

    function initHeroCanvasFade() {
        const heroSection = document.getElementById('hero');
        const heroCanvasContainer = document.getElementById('heroCanvasContainer');
        if (!heroSection || !heroCanvasContainer) return;

        function updateHeroOpacity() {
            const heroHeight = heroSection.offsetHeight;
            const scrollY = window.scrollY;
            let opacity = 1;
            const startFade = heroHeight * 0.35;
            const endFade = heroHeight * 0.85;
            if (scrollY > startFade) {
                opacity = 1 - (scrollY - startFade) / (endFade - startFade);
                if (opacity < 0) opacity = 0;
            }
            heroCanvasContainer.style.opacity = opacity;
        }
        window.addEventListener('scroll', updateHeroOpacity, { passive: true });
        window.addEventListener('resize', updateHeroOpacity, { passive: true });
        updateHeroOpacity();
    }

    window.ScindaxNavigation = {
        init: function () {
            initNavbarScrollState();
            initSmoothAnchors();
            initHeroCanvasFade();
        }
    };
})();

const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");


if (menuToggle && navLinks) {


    // Abrir / fechar menu pelo botão hamburger
    menuToggle.addEventListener("click", () => {

        navLinks.classList.toggle("active");

        menuToggle.classList.toggle("open");

    });




    // Fechar menu ao clicar em qualquer link
    const menuItems = navLinks.querySelectorAll("a");


    menuItems.forEach(item => {


        item.addEventListener("click", () => {


            navLinks.classList.remove("active");

            menuToggle.classList.remove("open");


        });


    });






    // Fechar menu ao clicar fora dele
    document.addEventListener("click", (event) => {


        const clickedInsideMenu =
            navLinks.contains(event.target);


        const clickedButton =
            menuToggle.contains(event.target);




        if (!clickedInsideMenu && !clickedButton) {


            navLinks.classList.remove("active");

            menuToggle.classList.remove("open");


        }


    });



}