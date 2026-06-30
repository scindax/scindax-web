# Scindax — Landing Page

Site institucional da Scindax: uma landing page de página única que apresenta
a proposta de evolução empresarial através da organização, a jornada
metodológica (AMES → Diagnóstico → Evolução Contínua) e o convite para a
Avaliação de Maturidade Empresarial Scindax (AMES).

Construída em HTML, CSS e JavaScript puro (sem frameworks, sem bundlers e sem
dependências externas), com um plano de fundo animado em Canvas 2D no hero e
animações de entrada acionadas por scroll. Serve também como base para o
futuro Portal Scindax.

## Tecnologias

- HTML5 semântico
- CSS3 (variáveis customizadas, grid, flexbox, animações)
- JavaScript (ES6+) sem dependências
- Canvas 2D API para o campo de partículas do hero
- IntersectionObserver para as animações de entrada
- Fonte Inter (Google Fonts)

## Estrutura de pastas

```
scindax-web/
├── index.html              # Marcação da página
├── css/
│   └── styles.css          # Estilos (variáveis, layout, componentes, responsivo)
├── js/
│   ├── main.js             # Bootstrap, configuração da AMES e ano do rodapé
│   ├── particles.js        # Campo de partículas do hero (Canvas)
│   ├── navigation.js       # Navbar, rolagem suave e fade do canvas
│   └── animations.js       # Animações de entrada (IntersectionObserver)
├── assets/
│   ├── images/
│   │   ├── logo-scindax.png
│   │   └── favicon-64.png
│   ├── icons/
│   └── fonts/
├── favicon.ico
├── robots.txt
├── sitemap.xml
├── README.md
└── LICENSE
```

## Como executar localmente

O projeto é estático e não exige build. Há duas formas de executar:

**Abrindo diretamente**

Abra o arquivo `index.html` no navegador.

**Servindo localmente (recomendado)**

Para evitar restrições de carregamento de arquivos locais em alguns
navegadores, sirva a pasta com um servidor HTTP simples:

```bash
# Python 3
python -m http.server 8000

# ou Node (npx, sem instalar nada global)
npx serve .
```

Acesse `http://localhost:8000`.

## Como publicar na Vercel

1. Faça o push do repositório para o GitHub.
2. Em [vercel.com](https://vercel.com), selecione **Add New → Project** e
   importe o repositório.
3. Em **Framework Preset**, selecione **Other** (projeto estático).
4. Deixe **Build Command** vazio e defina **Output Directory** como a raiz do
   projeto (`.`).
5. Clique em **Deploy**. A cada push na branch principal, a Vercel publica
   automaticamente uma nova versão.

## Como configurar o domínio no Cloudflare

1. No painel da Vercel, abra **Settings → Domains** do projeto e adicione
   `scindax.com.br`. A Vercel informará os registros DNS necessários.
2. No Cloudflare, selecione o domínio e vá em **DNS → Records**.
3. Adicione os registros indicados pela Vercel:
   - um registro `A` (ou `CNAME`) para o apex `scindax.com.br`;
   - um registro `CNAME` para `www` apontando para o destino da Vercel.
4. Mantenha o proxy do Cloudflare (nuvem laranja) conforme a recomendação da
   Vercel para o seu caso e aguarde a propagação do DNS.
5. Em **SSL/TLS**, utilize o modo **Full** para garantir HTTPS de ponta a
   ponta.

## Licença

Projeto proprietário. Todos os direitos reservados à Scindax. Consulte o
arquivo [LICENSE](LICENSE) para os termos de uso.
