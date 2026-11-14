/* Background paths only. Human and monster rendering belong to the museum engine. */
window.OIBUNG_SCENE_ASSETS=Object.freeze(Object.fromEntries(['entrance','lobby','left','right','focus','special'].map(area=>[area,Object.fromEntries(['light','dark'].map(mode=>[mode,{desktop:`assets/museum/${area}-${mode}.avif`,mobile:`assets/museum/${area}-${mode}-mobile.avif`}]))])));
