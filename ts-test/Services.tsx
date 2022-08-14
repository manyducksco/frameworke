import { Service } from "@woofjs/client";
import type { AppServices } from "./test";

export const ExampleService = new Service(function () {
  const services = this.services as AppServices;

  services.users.getUsers().then(() => {
    this.debug.log();
  });

  return {
    test: true,
  };
});
