import { createRoot, type Root } from "react-dom/client";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import TaskItem from "@tiptap/extension-task-item";

import { Checkbox } from "@/components/ui/checkbox";

function checkboxLabel(node: ProseMirrorNode) {
  return `Task item checkbox for ${node.textContent || "empty task"}`;
}

export const AskaTaskItem = TaskItem.extend({
  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement("li");
      const checkboxMount = document.createElement("span");
      const content = document.createElement("div");
      let checkboxRoot: Root | undefined;

      listItem.dataset.type = "taskItem";
      checkboxMount.contentEditable = "false";
      checkboxMount.className = "note-task-checkbox";
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          listItem.setAttribute(key, String(value));
        }
      });

      const setChecked = (checked: boolean) => {
        if (!editor.isEditable || typeof getPos !== "function") return;
        const position = getPos();
        if (typeof position !== "number") return;

        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .command(({ tr }) => {
            const currentNode = tr.doc.nodeAt(position);
            if (!currentNode) return false;

            tr.setNodeMarkup(position, undefined, {
              ...currentNode.attrs,
              checked,
            });
            return true;
          })
          .run();
      };

      const renderCheckbox = (currentNode: ProseMirrorNode) => {
        checkboxRoot ??= createRoot(checkboxMount);
        checkboxRoot.render(
          <Checkbox
            aria-label={checkboxLabel(currentNode)}
            checked={currentNode.attrs.checked === true}
            disabled={!editor.isEditable}
            onCheckedChange={(checked) => setChecked(checked === true)}
          />,
        );
        listItem.dataset.checked = String(currentNode.attrs.checked === true);
      };

      renderCheckbox(node);
      listItem.append(checkboxMount, content);

      return {
        dom: listItem,
        contentDOM: content,
        stopEvent: (event) => checkboxMount.contains(event.target as Node),
        ignoreMutation: (mutation) => checkboxMount.contains(mutation.target),
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) return false;
          renderCheckbox(updatedNode);
          return true;
        },
        destroy: () => checkboxRoot?.unmount(),
      };
    };
  },
});
