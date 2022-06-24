import styles from "./index.module.css";
import { repeat, unless, when } from "@woofjs/client";

/**
 * Displays a tree of all views and links to navigate to each.
 */
export default ($attrs, self) => {
  self.debug.name = "NavigationPanel";

  const { $collections } = self.getService("view");

  self.watchState($collections, self.debug.log);

  return (
    <div class={styles.panel}>
      <ul>
        {repeat($collections, ($attrs, self) => {
          const $collection = $attrs.map("value");
          const $views = $collection.map("views");
          const $hasManyViews = $views.map(
            (views) => views.length > 1 || views[0].name !== "@default"
          );

          self.watchState($collection, (value) => {
            self.debug.log("collection", value);
          });

          return (
            <li>
              {when($hasManyViews, () => {
                return (
                  <div>
                    <button className={[styles.item, styles.expander]}>
                      {$collection.map("path")}
                    </button>
                    <div class={styles.expandable}>
                      <ul>
                        {repeat($views, ($attrs, self) => {
                          const $view = $attrs.map("value");

                          return (
                            <li
                              style={{ marginLeft: "1rem", listStyle: "none" }}
                            >
                              <a class={styles.item} href={$view.map("path")}>
                                {$view.map("name")}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                );
              })}

              {unless($hasManyViews, () => {
                return (
                  <a class={styles.item} href={$collection.map("path")}>
                    {$collection.map("path")}
                  </a>
                );
              })}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
