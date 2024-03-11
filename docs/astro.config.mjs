import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import vue from "@astrojs/vue";
import tailwind from "@astrojs/tailwind";
import netlify from "@astrojs/netlify";

const site = "https://vue-fluid-dnd.netlify.app/";

// https://astro.build/config
export default defineConfig({
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es"],
  },
  integrations: [
    starlight({
      title: "VueFluidDnD",
      defaultLocale: "root",
      locales: {
        root: {
          label: "English",
          lang: "en",
        },
        es: {
          label: "Español",
          lang: "es",
        },
      },
      logo: {
        src: "/src/assets/logo.svg",
      },
      editLink: {
        baseUrl:
          "https://github.com/carlosjorger/vue-fluid-dnd/tree/main/docs/",
      },
      customCss: process.env.NO_GRADIENTS ? [] : ["/src/assets/landing.css"],
      social: {
        github: "https://github.com/carlosjorger/vue-fluid-dnd",
        "x.com": "https://twitter.com/carlosjorgerc",
      },
      components: {
        SiteTitle: "./src/components/CustomTitle.astro",
      },
      sidebar: [
        {
          label: "Introduction",
          items: [
            // Each item here is one entry in the navigation menu.
            {
              label: "Inicio rápido",
              link: "/introduction/introduction/",
            },
          ],
          translations: {
            es: "Introducción",
          },
        },
        {
          label: "Guide",
          items: [
            // Each item here is one entry in the navigation menu.
            {
              label: "Single vertical list",
              link: "/guides/verticallist/",
              translations: {
                es: "Lista vertical simple",
              },
            },
            {
              label: "List with mixed styles",
              link: "/guides/verticalliststyles/",
              translations: {
                es: "Lista vertical con diferentes estilos",
              },
            },
            {
              label: "List on a scroll",
              link: "/guides/verticallistautoscroll/",
              translations: {
                es: "Lista en un contenedor con scroll",
              },
            },
            {
              label: "Single horizontal list",
              link: "/guides/horizontallist/",
              translations: {
                es: "Lista horizontal simple",
              },
            },
          ],
          translations: {
            es: "Guía",
          },
        },
      ],
      head: [
        {
          tag: "meta",
          attrs: { property: "og:image", content: site + "org.webp?v=1" },
        },
        {
          tag: "meta",
          attrs: { property: "twitter:image", content: site + "og.webp?v=1" },
        },
      ],
      customCss: [
        // Path to your Tailwind base styles:
        "./src/tailwind.css",
        "./src/assets/landing.css",
      ],
    }),
    vue(),
    tailwind({ applyBaseStyles: false }),
  ],
  adapter: netlify(),
});
