module Main

open Fable.Core
open Fable.Core.JsInterop

[<EmitInline("console.log($0)")>]
let log msg = jsNative

let main () =
    log "Welcome to Fable 5.1!"
    log "Happy coding!"

main()
