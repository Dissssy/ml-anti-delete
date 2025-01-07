import { ExtensionWebExports } from "@moonlight-mod/types";

export const webpackModules: ExtensionWebExports["webpackModules"] = {
  entrypoint: {
    dependencies: [
      {
        "ext": "common",
        "id": "stores"
      },
      {
        "id": "discord/Dispatcher",
      }
    ],
    entrypoint: true
  },
};
