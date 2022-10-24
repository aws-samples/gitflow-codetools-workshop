const content = `
<\!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Sample Application</title>
  </head>
  <body style="background-color:orange;">
    <p>Hello from First Branch!</p>
  </body>
</html>
`;

//Handler function - change the "body" below
exports.handler = async function(event) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: content,
  };
};