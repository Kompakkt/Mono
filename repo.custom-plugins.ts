import { type ExtenderPlugin } from "@kompakkt/plugins/extender";
import { HelloWorldPlugin } from "@kompakkt/plugins/hello-world";

export default [new HelloWorldPlugin()] satisfies ExtenderPlugin[];
