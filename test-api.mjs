const testRegister = async () => {
  try {
    console.log('Testing register endpoint...');
    
    // tRPC httpBatchLink expects POST with body containing {json: {...}}
    const response = await fetch('http://localhost:3000/api/trpc/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          username: 'testuser1',
          password: 'password123',
          name: 'Test User',
        }
      }),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    // Try to test login after
    if (response.status === 200) {
      console.log('\nTesting login endpoint...');
      
      const loginResponse = await fetch('http://localhost:3000/api/trpc/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: {
            username: 'testuser1',
            password: 'password123',
          }
        }),
      });

      const loginData = await loginResponse.json();
      console.log('Login Status:', loginResponse.status);
      console.log('Login Response:', JSON.stringify(loginData, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

testRegister();
