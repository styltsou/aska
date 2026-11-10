export const handler = awslambda.streamifyResponse(
  async (_, responseStream) => {
    const stream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
    stream.write("ok");
    stream.end();
  },
);
