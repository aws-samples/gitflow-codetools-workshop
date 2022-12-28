//Handler function - change the "body" below
exports.handler = async function(event) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain" },
    body: 'Hello World Application - First Branch'
  };
};