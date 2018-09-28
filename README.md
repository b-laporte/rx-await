
# Rx-Await: Bridging Observables and async/await

**tl;dr** rx-await allows to use async functions instead of pipe operators in Observable streams


## Key features
- simple async/await mental model for stream transformation
- 4 simple operators to easily build all others (*task / cancel / callStackContext / promise*)
- operators are simple functions
- need for much less operators than with traditional ReactiveX implementations - as many can be replaced by a few lines of code (e.g. *if* instead of *filter*)
- less need to combine streams as they appear as functions in functions, so sub-streams can access their parent closure and interact with their parent streams directly.

## Core concept

Rx-Await core idea is to be able to write observable transformations as async functions like this:

<div style="text-align:center">

![Intro](doc/intro_code.png?raw=true)

</div>

High-level principles and examples can be found in these [slides] (note: this presentation assumes that readers are familiar with async/await and Observables concepts).

[slides]: https://docs.google.com/presentation/d/1o6m8Lg_vvYBnFlvJr8Vzy67k3TCzkyuYB58VXYgfQV8/edit?usp=sharing

## Build steps

Rx-Await requires a file pre-processing step to process *task functions* (i.e. the functions with a $$ parameter). The current implementation only offers a [rollup] plugin (cf. root folder).

[rollup]: https://rollupjs.org

## Building the project

In its current state Rx-Await is not available in npm - but the project is quite easy to build:

To retrieve all dependencies:

``` yarn install ```

To run all tests:

``` yarn test ```

To run the type-ahead example:

``` yarn build-samples && http-server ``` 

... then open your browser on http://127.0.0.1:8080/dist/typeahead/
