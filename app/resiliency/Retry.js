import {EnumSymbol, Enum} from '../utils/Enum';
import Reflect from 'harmony-reflect';

const  [INCREMENTAL, EXPONENTIAL, FIBONACCI] = [{},{},{}];
export const BackoffStrategy = new Enum({INCREMENTAL, EXPONENTIAL, FIBONACCI});

export class Retry {

  maxTries: number = 1;
  maxDelay: number = Infinity;
  delayRatio: number = 1;
  backoffStrategy: EnumSymbol = BackoffStrategy.INCREMENTAL;
  intermediate: Function = function() {};

  /**
   * Retry Class in Resiliency Framework
   * @constructor
   * @param {Number} maxTries - max number of tries. default 1
   * @param {Number} maxDelay - If backoff strategy reaches a point which is above this number, then each successive retry will top-out at 'maxDelay' seconds.
   * @param {Number} delayRatio - ratio for each delay between each try (in seconds). default 1
   * @param {EnumSymbol<BackoffStrategy>} backoffStrategy - algorithm for scaling of the delay between tries
   */
  constructor({maxTries , maxDelay, delayRatio, backoffStrategy, intermediate}) {

    if(maxTries) this.maxTries = maxTries;
    if(maxDelay) this.maxDelay = maxDelay;
    if(delayRatio) this.delayRatio = delayRatio;
    if(backoffStrategy) {
      if (BackoffStrategy.contains(backoffStrategy)) {
        this.backoffStrategy = backoffStrategy;
      } else {
        throw Error('backoffStrategy value should be of EnumSymbol<BackoffStrategy>  type');
      }
    }
    if(intermediate) this.intermediate = intermediate;

    switch(this.backoffStrategy) {
      case BackoffStrategy.INCREMENTAL:
        this._backoffStrategy = this.incremental();
        break;
      case BackoffStrategy.EXPONENTIAL:
        this._backoffStrategy = this.exponential();
        break;
      case BackoffStrategy.FIBONACCI:
        this._backoffStrategy = this.fibonacci();
        break;
      default:
        this._backoffStrategy = this.incremental();
        break;
    }

  }

  /**
   * @desc Retry failed (promise returning function) N times with delay.
   * @param  {Function} target - an async function (promise returning function)
   * @param  receiver - thisObject on which the <target> function should be called.
   * @param  args - arguments for <target> function.
   * @param  {Function} intermediate - provide an intermediate function which is called after each error.
   *         This method can be useful for logging or other operations between errors.
   *         By returning false you can cancel any additional tries.
   * @param {Number} maxTries - max number of tries. default this.maxTries
   * @returns {Promise} - Promise returned by original function.
   * TODO: exclude retrying certain exceptions e.g.  if (err instanceof TemporaryNetworkError)
   */
  async try(target: Function, receiver, args = [], intermediate: Function = this.intermediate, remainingTries: number = this.maxTries) {

    let delay = this._calculateDelay(remainingTries);

    await this._sleep(delay * 1000);

    //TODO convert regular function into Promise function
    //return Promise.cast(target.call(receiver,...args)).catch((error) => {
    return target.call(receiver, ...args).catch((error) => {

      let intermediateResult = intermediate(error, remainingTries, delay);

      if (remainingTries <= 1) {
        throw new Error('Giving up! maximum retry attempts reached.');
      }

      if(intermediateResult === false) {
        throw new Error('Intermediate callback returned false. Retry stopped.');

      } else {
        return this.try(target, receiver, args, intermediate, remainingTries - 1); //Tail Call Optimization
      }
    });

  }

  _calculateDelay(remainingTries: number) : number {
    let delay = this.delayRatio * this._backoffStrategy.next().value;
    return Math.min(delay, this.maxDelay);
  }

  _sleep(ms) : Promise {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  *incremental() {
    for (var i = 0; true; i++) {
      var reset = yield i;
      if (reset) {
        i = 0;
      }
    }
  }

  *exponential() {
    for (var i = 0; true; i++) {
      var reset = yield Math.pow(2, i);
      if (reset) {
        i = 0;
      }
    }
  }

  *fibonacci() {
    let [prev, curr] = [0, 1];
    while (true) {
      [prev, curr] = [curr, prev + curr];
      var reset = yield curr;
      if (reset) {
        [prev, curr] = [0, 1];
      }
    }
  }

  /**
   * Proxify given object with retry aspect.
   * @param obj - target object
   * @returns {Proxy}
   */
  static proxify(obj) {
    let classRetry;
    let proxifyed = false;

    //check if the target class or its methods are annotated with @retry
    if (obj.annotations) {
      for(let anno in obj.annotations) {
        if (anno instanceof Retry) {
          classRetry = anno;
        }
      }
    }

    for (let name in obj.__proto__) {
      let methodRetry = undefined;
      if (obj[name].annotations) {
        for (let anno of obj[name].annotations) {
          if (anno instanceof Retry) {
            methodRetry = anno;
          }
        }
      }

      if(methodRetry || classRetry) {
        proxifyed = true;
        let retry = methodRetry || classRetry;

        obj[name] = new Proxy(obj[name],{
          apply: (target, receiver, args) => {
            // return Retry.prototype.try.call(retry, target, receiver, args);
            return retry.try.call(retry, target, receiver, args);
          }
        });
      }
    }

    if(!proxifyed) {
      throw new Error('No @Retry annotations found on target class or its methods. Cannot apply Retry aspect');
    }

    return obj;
  }
}



