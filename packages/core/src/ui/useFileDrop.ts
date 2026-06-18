import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Full-window drag-and-drop. Reads dropped files into memory as
 * { name, bytes } and hands them to the caller. Tracks an "is dragging" flag
 * for the overlay. No file is ever held beyond the callback.
 */
export function useFileDrop(onFiles: (files: { name: string; bytes: Uint8Array }[]) => void): {
  dragging: boolean;
} {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const readFiles = useCallback(
    async (fileList: FileList) => {
      const files = await Promise.all(
        Array.from(fileList).map(async (f) => ({
          name: f.name,
          bytes: new Uint8Array(await f.arrayBuffer()),
        })),
      );
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      depth.current -= 1;
      if (depth.current <= 0) {
        depth.current = 0;
        setDragging(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (e.dataTransfer?.files?.length) void readFiles(e.dataTransfer.files);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [readFiles]);

  return { dragging };
}
