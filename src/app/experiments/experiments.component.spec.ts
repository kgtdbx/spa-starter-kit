/* tslint:disable:no-unused-variable */

import { By }           from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import {
  beforeEach, beforeEachProviders,
  describe, xdescribe,
  expect, it, xit,
  async, inject
} from '@angular/core/testing';

import { ExperimentsComponent } from './experiments.component';

describe('Component: Experiments', () => {
  it('should create an instance', () => {
    let component = new ExperimentsComponent();
    expect(component).toBeTruthy();
  });
});
