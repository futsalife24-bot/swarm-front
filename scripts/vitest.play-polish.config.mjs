export default {
  test: {
    include: ["scripts/measure-play-polish.test.ts"],
    testTimeout: 900000,
    fileParallelism: false,
  },
};
