import { describe, expect, it } from "vitest";
import { fitWithin } from "./compress";

describe("fitWithin", () => {
  it("leaves an image smaller than the max untouched", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("leaves an image exactly at the max untouched", () => {
    expect(fitWithin(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it("scales a landscape image by its longest edge", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a portrait image by its longest edge", () => {
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("scales a square image", () => {
    expect(fitWithin(2000, 2000, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("rounds to whole pixels", () => {
    expect(fitWithin(3000, 1999, 1600)).toEqual({ width: 1600, height: 1066 });
  });
});
