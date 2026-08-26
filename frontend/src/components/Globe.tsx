export function Globe() {
  return (
    <div className="scene-3d relative mx-auto h-[22rem] w-[22rem] xl:h-[28rem] xl:w-[28rem]">
      <div className="grid-fade absolute inset-[-18%] rounded-full" />
      <div className="ring ring-c" />
      <div className="ring ring-b" />
      <div className="ring ring-a" />
      <div className="globe" />
      <div className="globe-atmosphere" />
      <div className="globe-shine" />
    </div>
  )
}
