import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.ts';

describe('main', () => {
  it('should return Hello World', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Hello, World!');
  });
});
