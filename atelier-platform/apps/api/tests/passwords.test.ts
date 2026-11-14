import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword} from '../src/services/passwords.js';

test('password hashes use independent salts and reject incorrect or malformed credentials',async()=>{
  const password='A long café password 123!';
  const first=await hashPassword(password),second=await hashPassword(password);
  assert.notEqual(first,second);
  assert.equal(await verifyPassword(first,password),true);
  assert.equal(await verifyPassword(first,password+'x'),false);
  assert.equal(await verifyPassword(first.replace('$100000$','$1$'),password),false);
  assert.equal(await verifyPassword('pbkdf2-sha512$100000$bad$bad',password),false);
});
