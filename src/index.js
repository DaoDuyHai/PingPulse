try {
  const response = await fetch('https://vnexpss.net', {
    signal: AbortSignal.timeout(3000),
  });

  console.log(response.status);
} catch (error) {
  console.log(error);
}
