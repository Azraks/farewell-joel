// Only the hosted runtime APIs used by this function. This declaration performs no
// runtime setup; actual Deno execution must still be checked after deployment.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};
