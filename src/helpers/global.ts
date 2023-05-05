export class GL {
  /**
   * dumpError
   *
   * @static
   * @param {*} err
   * @memberof GL
   */
  public static dumpError = (err) => {
    if (typeof err === 'object') {
      if (err.message) {
        console.error('\nMessage: ' + err.message);
      }
      if (err.stack) {
        console.error('\nStacktrace:');
        console.error('====================');
        console.error(err.stack);
      }
    } else {
      console.error('dumpError :: argument is not an object');
    }
  };
}
