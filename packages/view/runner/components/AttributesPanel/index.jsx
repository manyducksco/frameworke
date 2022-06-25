import { repeat, unless, when, watch, proxyState } from "@woofjs/client";

import styles from "./index.module.css";

import InputColor from "./InputColor";
import InputDate from "./InputDate";
import InputNone from "./InputNone";
import InputNumber from "./InputNumber";
import InputRadio from "./InputRadio";
import InputRange from "./InputRange";
import InputSelect from "./InputSelect";
import InputText from "./InputText";
import InputToggle from "./InputToggle";

/**
 * Displays the current view's attributes and provides inputs for editing them.
 */
export default ($attrs, self) => {
  self.debug.name = "AttributesPanel";

  const { $currentView } = self.getService("view");

  const $attributes = $currentView.map((view) => {
    return view?.attributes || [];
  });
  const $hasAttrs = $attributes.map((attrs) => attrs.length > 0);

  return (
    <section class={styles.panel}>
      <header class={styles.panelHeader}>
        <h1>🎛️ Attributes</h1>
      </header>

      <div class={styles.panelContent}>
        {unless($hasAttrs, <p>This view has no attributes.</p>)}

        {when(
          $hasAttrs,
          <ul class={styles.attrsList}>
            {repeat($attributes, ($attrs, self) => {
              const $attribute = $attrs.map("value");

              const $name = $attribute.map("name");
              const $description = $attribute.map("description");

              // Using a proxy to have one state that can point to other states over time.
              const $value = proxyState($attribute.get("$value"));

              // Update which state the proxy points to when the attribute changes.
              self.watchState($attribute, (attr) => {
                $value.proxy(attr.$value);
              });

              return (
                <li class={styles.attrGroup}>
                  <h2 class={styles.attrHeader}>{$name}</h2>

                  {when(
                    $description,
                    <p class={styles.attrDescription}>{$description}</p>
                  )}

                  {watch($attribute, ({ input }) => {
                    switch (input.type) {
                      case "text":
                        return <InputText $value={$value} />;
                      case "number":
                        return <InputNumber $value={$value} />;
                      case "toggle":
                        return <InputToggle $value={$value} />;
                      case "color":
                        return <InputColor $value={$value} />;
                      case "date":
                        return <InputDate $value={$value} />;
                      case "select":
                        return (
                          <InputSelect
                            $value={$value}
                            options={input.options}
                          />
                        );
                      case "radio":
                        return (
                          <InputRadio $value={$value} options={input.options} />
                        );
                      case "range":
                        return (
                          <InputRange
                            $value={$value}
                            min={input.min}
                            max={input.max}
                            step={input.step}
                          />
                        );
                      case "none":
                        return <InputNone value={$value} />;
                      default:
                        throw new Error(`Unknown input type: ${input.type}`);
                    }
                  })}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
