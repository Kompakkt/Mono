import { type ExtenderPlugin } from "@kompakkt/extender";
import { OIDCPlugin } from "@kompakkt/plugins/oidc";

export default [new OIDCPlugin()] satisfies ExtenderPlugin[];
