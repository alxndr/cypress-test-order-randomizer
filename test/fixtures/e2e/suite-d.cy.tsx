// .tsx extension exercises the tsx esbuild loader and Babel jsx plugin path.
describe('suite-d', () => {
  it('D1', () => {})
  it.skip('D2', () => {})
  it('D3', () => {})
  describe.skip('inner-d-skipped', () => {
    it('D4', () => {})
    it('D5', () => {})
  })
  describe('inner-d-running', () => {
    it('D6', () => {})
    it('D7', () => {})
  })
  it('D8', () => {})
})
