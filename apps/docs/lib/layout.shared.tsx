import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: "pagebldr" },
    githubUrl: "https://github.com/StartUpMediaUK/pagebldr",
    links: [
      {
        text: "npm",
        url: "https://www.npmjs.com/package/pagebldr",
        external: true,
      },
    ],
  };
}
