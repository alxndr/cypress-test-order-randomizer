describe('suite-c', () => {
  describe('inner-1', () => {
    it('C1', () => {})
    it('C2', () => {})
    it('C3', () => {})
    it('C4', () => {})
    it('C5', () => {})
    it('C6', () => {})
  })

  describe('inner-2', () => {
    it('C7', () => {})
    it('C8', () => {})
    it('C9', () => {})
    describe('inner-2 nested 1', () => {
      it('C13', () => {})
      it('C14', () => {})
      it('C15', () => {})
    })
    it('C10', () => {})
    it('C11', () => {})
    it('C12', () => {})
  })
})
