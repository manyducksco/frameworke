import { makeGlobal } from "../makeGlobal.js";
import { makeState } from "../makeState.js";
import { APP_CONTEXT } from "../keys.js";
import { ViewBlueprint } from "../blueprints/View.js";
import { Global } from "../_experimental/Global.js";

/**
 * Manages dialogs. Also known as modals.
 * TODO: Describe this better.
 */
export default class extends Global {
  setup(ctx) {
    /**
     * A first-in-last-out queue of dialogs. The last one appears on top.
     * This way if a dialog opens another dialog the new dialog stacks.
     */
    const $$dialogs = makeState([]);

    // Add $dialogs to app context so the app can display them.
    ctx[APP_CONTEXT].$dialogs = $$dialogs.readable();

    return {
      makeDialog: (view, options) => makeDialog(view, options, ctx, $$dialogs),
    };
  }
}

function makeDialog(viewFn, options, ctx, $$dialogs) {
  const blueprint = new ViewBlueprint(viewFn);

  const $$open = makeState(true);
  let openSubscription;
  let view;

  function open(attributes = {}) {
    $$open.set(true);

    view = blueprint.build({
      appContext: ctx[APP_CONTEXT],
      attributes: {
        ...attributes,
        $$open,
      },
    });

    $$dialogs.update((current) => {
      current.push(view);
    });

    openSubscription = $$open.subscribe((value) => {
      if (!value) {
        close();
      }
    });
  }

  function close() {
    if (view) {
      $$dialogs.update((current) => {
        current.splice(
          current.findIndex((v) => v === view),
          1
        );
      });
      view = null;
    }

    if (openSubscription) {
      openSubscription.unsubscribe();
      openSubscription = null;
    }
  }

  return {
    open,
    close,
  };
}

// export default makeGlobal((ctx) => {
//   /**
//    * A first-in-last-out queue of dialogs. The last one appears on top.
//    * This way if a dialog opens another dialog the new dialog stacks.
//    */
//   const $$dialogs = makeState([]);

//   // Add $dialogs to app context so the app can display them.
//   ctx[APP_CONTEXT].$dialogs = $$dialogs.readable();

//   return {
//     makeDialog: (view, options) => makeDialog(view, options, ctx, $$dialogs),
//   };
// });

// function makeDialog(viewFn, options, ctx, $$dialogs) {
//   const blueprint = new ViewBlueprint(viewFn);

//   const $$open = makeState(true);
//   let openSubscription;
//   let view;

//   function open(attributes = {}) {
//     $$open.set(true);

//     view = blueprint.build({
//       appContext: ctx[APP_CONTEXT],
//       attributes: {
//         ...attributes,
//         $$open,
//       },
//     });

//     $$dialogs.update((current) => {
//       current.push(view);
//     });

//     openSubscription = $$open.subscribe((value) => {
//       if (!value) {
//         close();
//       }
//     });
//   }

//   function close() {
//     if (view) {
//       $$dialogs.update((current) => {
//         current.splice(
//           current.findIndex((v) => v === view),
//           1
//         );
//       });
//       view = null;
//     }

//     if (openSubscription) {
//       openSubscription.unsubscribe();
//       openSubscription = null;
//     }
//   }

//   return {
//     open,
//     close,
//   };
// }
