# Image pipeline

The image pipeline consists of two independent AWS Lambda consumers:

```txt
S3 ingest/ object-created event
  ├─ ImageVariantsQueue -> variants Lambda -> assets/{storageId}/*.webp
  └─ ImagePaletteQueue  -> palette Lambda  -> image_colors callback
```

Both queues receive the same original-object event and read the original from
S3. The image asset already exists before the upload begins, so either callback
may arrive first. The variants worker updates rendition metadata; the palette
worker updates palette data and its own enrichment status.

Each queue has a separate 180-second visibility timeout, retry budget, and
dead-letter queue. A failure in palette extraction never re-runs variant
generation. The infrastructure is defined in the root
[`sst.config.ts`](../../sst.config.ts). Use `bun run dev` for a variants event
fixture and `bun run dev:palette` for a palette event fixture.
