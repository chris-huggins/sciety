import dotenv from 'dotenv';
import {
  click, closeBrowser, goto, into, link, openBrowser, textBox, write,
} from 'taiko';

jest.setTimeout(15000);

describe('login', () => {
  afterAll(closeBrowser);

  it('authenticates via Twitter', async () => {
    dotenv.config();
    await openBrowser();
    await goto('localhost:8080');
    await click('Log in');
    await write(process.env.TAIKO_TWITTER_USERNAME ?? '', into(textBox('Username')));
    await write(process.env.TAIKO_TWITTER_PASSWORD ?? '', into(textBox('Password')));
    await click('Sign in');
    const result = await link('Log out').exists();

    expect(result).toBe(true);
  });
});
