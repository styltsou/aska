export const handler = awslambda.streamifyResponse(
  async (_, responseStream) => {
    responseStream.end("ok");
  },
);
