import { AUTH_TOKEN_PREFIX } from '@api/DemoBlazeApiClient';
import { requests } from '@api/requests';
import { API_ERRORS } from '@api/types';
import { expect, knownDefect, test } from '@fixtures';
import { uniqueUsername } from '@utils/data';

test.describe('Login API', () => {
  test(
    'TC-LOGIN-031 valid login returns an auth token',
    { tag: ['@smoke', '@regression', '@api', '@login'] },
    async ({ api, userFactory }) => {
      const { username, password } = await userFactory.create('api');

      const result = await api.raw<string>(requests.login(username, password));

      expect(result.status).toBe(200);
      expect(result.body).toMatch(/^Auth_token: \S+$/);
      const token = result.body.slice(AUTH_TOKEN_PREFIX.length);
      expect((await api.checkToken(token)).username).toBe(username);
    },
  );

  test(
    'TC-LOGIN-032 wrong password returns an error message',
    { tag: ['@regression', '@api', '@login'] },
    async ({ api, userFactory }) => {
      const { username } = await userFactory.create('api');

      const result = await api.raw(requests.login(username, 'wrong'));

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ errorMessage: API_ERRORS.wrongPassword });
    },
  );

  test(
    'TC-LOGIN-033 unknown user returns an error message',
    { tag: ['@regression', '@api', '@login'] },
    async ({ api }) => {
      const result = await api.raw(requests.login(uniqueUsername('nouser'), 'any'));

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ errorMessage: API_ERRORS.userNotFound });
    },
  );

  test(
    'TC-LOGIN-011 password is case-sensitive',
    { tag: ['@regression', '@api', '@login'] },
    async ({ api, userFactory }) => {
      const { username, password } = await userFactory.create('api');
      expect(password.toLowerCase()).not.toBe(password);

      const result = await api.raw(requests.login(username, password.toLowerCase()));

      expect(result.body).toEqual({ errorMessage: API_ERRORS.wrongPassword });
    },
  );

  test(
    'TC-LOGIN-035 empty username and password return a clear client error',
    { tag: ['@regression', '@api', '@login'] },
    async ({ api }) => {
      knownDefect('BUG-011', 'Login API returns HTTP 500 for empty username and password');

      const result = await api.raw(requests.login('', ''));

      expect(result.status).toBeLessThan(500);
      expect(result.body).toEqual({ errorMessage: expect.any(String) });
    },
  );

  test(
    'TC-LOGIN-040 sign-up with an already registered username is rejected',
    { tag: ['@regression', '@api', '@login'] },
    async ({ api, userFactory }) => {
      const { username, password } = await userFactory.create('dup');

      const result = await api.raw(requests.signup(username, 'Another1!'));

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ errorMessage: API_ERRORS.userExists });
      const token = await api.login(username, password);
      expect((await api.checkToken(token)).username, 'original account is unchanged').toBe(
        username,
      );
    },
  );
});
