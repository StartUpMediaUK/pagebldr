import { useState } from "react";
import { resourceKey, type Pagebldr, type MediaItem } from "pagebldr";
import { MediaPicker, MediaViewer } from "pagebldr/react";

/** A separate Host route exercises the public picker without editor internals. */
export function MediaExample({ builder }: { readonly builder: Pagebldr }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<readonly MediaItem[]>([]);
  const [viewer, setViewer] = useState<MediaItem | null>(null);
  return (
    <main>
      <a href="#/editor">Back to editor</a>
      <h1>Shared media reference adapter</h1>
      <button onClick={() => setOpen(true)}>Browse all media</button>
      <output aria-label="Committed media">
        {selected.map((item) => resourceKey(item.reference)).join(", ") ||
          "None"}
      </output>
      <ul>
        {selected.map((item) => (
          <li key={resourceKey(item.reference)}>
            <button onClick={() => setViewer(item)}>
              View {item.displayName}
            </button>
          </li>
        ))}
      </ul>
      <MediaPicker
        builder={builder}
        label="Choose reference media"
        open={open}
        onOpenChange={setOpen}
        allowed={["image", "video", "audio", "document"]}
        maximum={30}
        onCommit={setSelected}
      />
      <MediaViewer item={viewer} onClose={() => setViewer(null)} />
    </main>
  );
}
