describe('types index', () => {
  it('exports types module', async () => {
    const types = await import('../../types');
    expect(types).toBeTruthy();
  });
});

