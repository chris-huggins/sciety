import * as O from 'fp-ts/Option';
import { constant, pipe } from 'fp-ts/function';
import { HtmlFragment, toHtmlFragment } from '../types/html-fragment';

const renderTagManagerScript = (tagManagerId: string) => `
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}

    gtag('consent', 'default', {
      'ad_storage': 'denied',
      'analytics_storage': 'denied'
    });
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${tagManagerId}');
  </script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', '${tagManagerId}');
  </script>
`;

const renderTagManagerNoScript = (tagManagerId: string) => `
  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${tagManagerId}"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->
`;

const renderFathomScript = (fathomId: string) => `
  <script src="https://cdn.usefathom.com/script.js" data-site="${fathomId}" defer></script>
`;

export const googleTagManager = (): HtmlFragment => pipe(
  process.env.GOOGLE_TAG_MANAGER_ID,
  O.fromNullable,
  O.map(renderTagManagerScript),
  O.getOrElse(constant('')),
  toHtmlFragment,
);

export const googleTagManagerNoScript = (): HtmlFragment => pipe(
  process.env.GOOGLE_TAG_MANAGER_ID,
  O.fromNullable,
  O.map(renderTagManagerNoScript),
  O.getOrElse(constant('')),
  toHtmlFragment,
);

export const fathom = (): HtmlFragment => pipe(
  process.env.FATHOM_SITE_ID,
  O.fromNullable,
  O.map(renderFathomScript),
  O.getOrElse(constant('')),
  toHtmlFragment,
);
