/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /**
     * Set by src/middleware.ts for any guarded /admin route, so it is present on
     * every admin page. Optional in the type because middleware does not set it
     * for the 96 prerendered public pages, which it deliberately does not touch.
     */
    admin?: import('./lib/admin/auth').Admin;
  }
}
