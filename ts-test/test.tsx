import {
  makeApp,
  makeComponent,
  makeService,
  makeState,
  mergeStates,
} from "@woofjs/client";
import { makeModel, collectionOf, ShapeOf, v } from "@woofjs/data";

import type { ServicesOf } from "@woofjs/client";

const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  status: v.oneOf("online", "offline", "busy", v.number()),
  preferences: v.object({
    email: v.boolean(),
  }),
});

// const t = tuplify("online", "offline", "busy", v.string());

const User = makeModel({
  key: "id",
  schema: UserSchema,
});

type UserShape = ShapeOf<typeof UserSchema>;

// import { ExampleService } from "./Services";

const $label = makeState("asdf");
const $label2 = makeState(12345);
const $label3 = makeState("123123");

const $message = mergeStates($label, $label2)
  .with($label3)
  .into((one, two, three) => {
    return one + two + three;
  });

const ExampleService = makeService((ctx) => {
  return {
    /**
     * Comment that shows up on inline documentation.
     */
    message: "hello",
  };
});

const UserService = makeService((ctx) => {
  return {
    async getUsers() {
      return [];
    },
  };
});

export const app = makeApp({
  // It's pretty much necessary to define the services in an object so the types can be extracted.
  services: {
    example: ExampleService,
    users: UserService,
    fn: () => ({ isFunction: true }),
  },
});

export type AppServices = ServicesOf<typeof app>;

const Example3 = makeComponent<any, AppServices>((ctx) => {
  const $title = ctx.$attrs.map((attrs) => attrs.title);

  const { http, example, fn } = ctx.services;

  return null;
});
