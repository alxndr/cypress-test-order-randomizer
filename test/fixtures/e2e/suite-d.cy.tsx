// .tsx extension exercises the tsx esbuild loader and Babel jsx plugin path.
describe('suite-d', () => {
  it('D1', () => {})
  it('D2', () => {})
  it.skip('D3', () => {})
  describe.skip('inner-d-skipped', () => {
    it('D4', () => {})
    it('D5', () => {})
  })
  it('D6', () => {})
})
