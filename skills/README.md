# oafp skills

These skills help an agent produce and verify oafp recipes. Choose the smallest skill that covers the task:

| Skill | Use for |
| --- | --- |
| [oafp-author](oafp-author/SKILL.md) | Complete commands, YAML parameter files, conversions and pipelines |
| [openaf-path](openaf-path/SKILL.md) | JMESPath/OpenAF expressions, projections, types and quoting |
| [oafp-decide](oafp-decide/SKILL.md) | Stateless decision requests, provider samples and result extraction |
| [oafp-json-schema](oafp-json-schema/SKILL.md) | Validation, schema inference, sample generation and validation gates |

An agent can read a linked `SKILL.md` directly. For discovery in a skill-aware client, copy the desired skill directories, including their references and assets, into that client's skill directory. Companion skills are optional; installing all four preserves their relative links. Keep this checkout available for source discovery, or use installed oafp help when it is unavailable. The oafp package build does not install these agent skills.

Recipes require OpenAF and the `oafproc` oPack (`oafp` on PATH). The installed runtime may differ from this checkout; decision APIs and newer schema drafts require corresponding OpenAF support. Provider calls additionally need the user's model configuration. Sample generation and the bundled regression recipes need no credentials or inference.

Run asset commands from the repository root. File paths inside parameter maps are relative to the process working directory, not the YAML file. After copying an asset elsewhere, adjust those paths.

The regression suite checks the bundled recipes through the generated CLI, including parameter-file loading and output values:

```sh
cd src && ojob build.yaml op=test
```

The decision request asset is also exercised with a stub provider. These checks establish local parsing and composition, not live provider behavior.
