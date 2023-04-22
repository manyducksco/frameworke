import { m, Spring, Writable, Ref, Readable } from "@borf/browser";
import dedent from "dedent";
import { ExampleFrame } from "../../views/ExampleFrame";

import styles from "./SpringAnimation.module.css";

/**
 * Demonstrates the use of Spring for animation.
 */
export function SpringAnimation(self) {
  const $$stiffness = new Writable(1549);
  const $$mass = new Writable(7);
  const $$damping = new Writable(83);
  const $$velocity = new Writable(14);

  const preset = (stiffness, mass, damping, velocity) => () => {
    $$stiffness.value = stiffness;
    $$mass.value = mass;
    $$damping.value = damping;
    $$velocity.value = velocity;
  };

  // Render the current settings as a code snippet to copy and paste.
  const $codeSnippet = Readable.merge(
    [$$stiffness, $$mass, $$damping, $$velocity],
    (s, m, d, v) => {
      return dedent`
        const spring = new Spring({
          stiffness: ${s},
          mass: ${m},
          damping: ${d},
          velocity: ${v}
        });
      `;
    }
  );

  return m(ExampleFrame, { title: "Spring Animation" }, [
    m("p", "The shapes below are animated by a single spring."),

    m(Examples, {
      stiffness: $$stiffness,
      damping: $$damping,
      mass: $$mass,
      velocity: $$velocity,
    }),

    m(
      "p",
      "That spring's properties can be tweaked with the following sliders:"
    ),

    m("div", { class: styles.controls }, [
      m(ControlGroup, {
        label: "Stiffness",
        value: $$stiffness,
        min: 0,
        max: 2000,
      }),
      m(ControlGroup, {
        label: "Mass",
        value: $$mass,
        min: 1,
        max: 50,
      }),
      m(ControlGroup, {
        label: "Damping",
        value: $$damping,
        min: 1,
        max: 400,
      }),
      m(ControlGroup, {
        label: "Velocity",
        value: $$velocity,
        min: -100,
        max: 100,
      }),
    ]),

    m("p", "Presets:"),

    m("ul", { class: styles.presetList }, [
      m("li", [
        m(
          "button",
          { class: styles.presetButton, onclick: preset(1845, 1, 28, 0) },
          "Clunky"
        ),
      ]),
      m("li", [
        m(
          "button",
          { class: styles.presetButton, onclick: preset(1354, 7, 66, 0) },
          "Marshmallowy"
        ),
      ]),
      m("li", [
        m(
          "button",
          { class: styles.presetButton, onclick: preset(2000, 5, 400, 3) },
          "Corporate"
        ),
      ]),
      m("li", [
        m(
          "button",
          { class: styles.presetButton, onclick: preset(648, 1, 28, 0) },
          "Punchy"
        ),
      ]),
      m("li", [
        m(
          "button",
          { class: styles.presetButton, onclick: preset(841, 41, 301, 0) },
          "Smooth"
        ),
      ]),
    ]),

    m(
      "p",
      "Once you find the settings you like, plug those numbers into your code like so:"
    ),

    m("pre", m("code", $codeSnippet)),
  ]);
}

export function Examples(self) {
  const $stiffness = self.inputs.$("stiffness"); // Amount of stiffness or tension in the spring.
  const $mass = self.inputs.$("mass"); // How heavy the spring is.
  const $damping = self.inputs.$("damping"); // Amount of smoothing. Affects the speed of transitions.
  const $velocity = self.inputs.$("velocity"); // How much force the spring's motion begins with.

  const spring = new Spring({
    stiffness: $stiffness,
    mass: $mass,
    damping: $damping,
    velocity: $velocity,
  });

  const animate = async () => {
    return spring
      .to(1)
      .then(() => spring.to(0))
      .then(() => {
        animate();
      });
  };

  self.onConnected(() => {
    animate();
  });

  return m("div", { class: styles.examples }, [
    m("div", { class: styles.exampleCanvas }, [
      m("div", {
        style: {
          width: 24,
          height: 24,
          borderRadius: "50%",
          backgroundColor: "red",
          transform: spring.map((x) => `translateX(${x * 160 - 80}%)`),
        },
      }),
    ]),

    m("div", { class: styles.exampleCanvas }, [
      m("div", {
        style: {
          position: "absolute",
          inset: "0 0.5rem",
          backgroundColor: "orange",
          transform: spring.map(
            (current) => `translateY(${90 - (1 - current) * 60}%)`
          ),
        },
      }),
    ]),

    m("div", { class: styles.exampleCanvas }, [
      m("div", {
        style: {
          position: "absolute",
          width: 36,
          height: 36,
          backgroundColor: "purple",
          transform: spring.map((x) => `scale(${0.5 + x * 1})`),
        },
      }),
    ]),

    m("div", { class: styles.exampleCanvas }, [
      m("div", {
        style: {
          position: "absolute",
          width: 2,
          height: 60,
          backgroundColor: "white",
          transformOrigin: "bottom center",
          transform: spring.map((x) => `rotate(${45 + x * -90}deg)`),
        },
      }),
    ]),
  ]);
}

function ControlGroup(self) {
  const $label = self.inputs.$("label");
  const $min = self.inputs.$("min");
  const $max = self.inputs.$("max");
  const $$value = self.inputs.$$("value");

  return m("div", { class: styles.controlGroup }, [
    m("label", { for: $label }, [
      m("span", $label),
      m("span", { class: styles.controlLabel }, $$value),
    ]),

    m("input", {
      class: styles.controlInput,
      id: $label,
      type: "range",
      min: $min,
      max: $max,
      value: $$value,
    }),
  ]);
}
