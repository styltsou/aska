/** Shared queue, pipeline, and callback contracts for the image-processing worker. */

/** Runtime bindings and secrets supplied by the generated Worker environment type. */
export type PipelineEnv = Env & {
	PIPELINE_API_BASE_URL: string;
	PIPELINE_CALLBACK_SECRET: string;
};

/** The portion of an R2 event required to identify and validate a source object. */
export type R2ObjectEvent = {
	object: {
		key: string;
		size?: number;
		eTag?: string;
	};
};

/** One persisted colour emitted by palette extraction. */
export type PipelinePaletteColor = {
	hex: string;
	oklabL: number;
	oklabA: number;
	oklabB: number;
	coverage: number;
	salience: number;
	isAccent: boolean;
};

/** Metadata for an R2 derivative written by the pipeline. */
export type PipelineVariant = {
	role: "display" | "preview";
	objectKey: string;
	width: number;
	height: number;
	contentType: "image/webp";
	sizeBytes: number;
};

/** Fields shared by every lifecycle event for the same immutable original object. */
type PipelineCallbackBase = {
	originalObjectKey: string;
	originalEtag: string;
};

/** Signals that the queue consumer accepted an original image for processing. */
export type PipelineProcessingCallback = PipelineCallbackBase & {
	status: "processing";
};

/** Carries all generated data after image processing succeeds. */
export type PipelineCompletedCallback = PipelineCallbackBase & {
	status: "completed";
	width: number;
	height: number;
	format: string;
	blurDataURL: string;
	extractionVersion: number;
	palette: PipelinePaletteColor[];
	variants: PipelineVariant[];
};

/** Records a terminal processing failure after retry attempts are exhausted. */
export type PipelineFailedCallback = PipelineCallbackBase & {
	status: "failed";
	error: string;
};

/** Discriminated lifecycle event sent from the worker to the API callback route. */
export type PipelineCallback =
	| PipelineProcessingCallback
	| PipelineCompletedCallback
	| PipelineFailedCallback;
